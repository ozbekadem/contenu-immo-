-- Linkimmo — installation complète du serveur (généré à partir de supabase/migrations/).
-- À coller en une fois dans Supabase : SQL Editor → New query → Run.

-- ════════════════════════════════════════════════════════════════════════════
-- Linkimmo — schéma serveur (Supabase / PostgreSQL)
-- À coller dans Supabase : SQL Editor → New query → Run.
-- Ré-exécutable sans risque (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Profils (un par utilisateur) ───────────────────────────────────────────
create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nom text not null default '',
  role text not null default 'collaborateur' check (role in ('admin', 'collaborateur', 'stagiaire')),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Création automatique du profil ; le tout premier utilisateur devient administrateur.
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, email, nom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profils) then 'collaborateur' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists creer_profil on auth.users;
create trigger creer_profil after insert on auth.users
  for each row execute function public.creer_profil();

create or replace function public.est_membre() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profils where id = auth.uid() and actif)
$$;

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profils where id = auth.uid() and actif and role = 'admin')
$$;

alter table public.profils enable row level security;
drop policy if exists profils_lecture on public.profils;
create policy profils_lecture on public.profils for select using (public.est_membre());
drop policy if exists profils_admin on public.profils;
create policy profils_admin on public.profils for update using (public.est_admin());

-- ─── Appareils (déconnexion à distance d'un appareil perdu) ─────────────────
create table if not exists public.appareils (
  user_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  id text not null,
  nom text not null default '',
  derniere_activite timestamptz not null default now(),
  revoque boolean not null default false,
  revoque_le timestamptz,
  primary key (user_id, id)
);

alter table public.appareils enable row level security;
drop policy if exists appareils_lecture on public.appareils;
create policy appareils_lecture on public.appareils for select using (user_id = auth.uid() or public.est_admin());
drop policy if exists appareils_ajout on public.appareils;
create policy appareils_ajout on public.appareils for insert with check (user_id = auth.uid() and public.est_membre());
drop policy if exists appareils_maj on public.appareils;
create policy appareils_maj on public.appareils for update using (user_id = auth.uid() or public.est_admin());

-- Un appareil déconnecté à distance ne peut pas annuler lui-même sa déconnexion (seul l'admin le peut).
create or replace function public.proteger_revocation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.revoque and not new.revoque and not public.est_admin() then
    raise exception 'Seul un administrateur peut réactiver un appareil déconnecté' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists proteger_revocation on public.appareils;
create trigger proteger_revocation before update on public.appareils
  for each row execute function public.proteger_revocation();

-- ─── Fiches synchronisées ───────────────────────────────────────────────────
-- Chaque fiche (contact, document, bien, piste…) est stockée avec ses données et,
-- pour chaque champ, l'horodatage de sa dernière modification (fusion champ par champ).
create sequence if not exists public.seq_sync;

create table if not exists public.enregistrements (
  entite text not null check (entite ~ '^[a-zA-Z]+$'),
  id uuid not null,
  donnees jsonb not null default '{}',
  ts jsonb not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  server_seq bigint not null default nextval('public.seq_sync'),
  primary key (entite, id)
);
create index if not exists enregistrements_seq on public.enregistrements (server_seq);

alter table public.enregistrements enable row level security;
drop policy if exists enregistrements_lecture on public.enregistrements;
create policy enregistrements_lecture on public.enregistrements for select using (public.est_membre());
drop policy if exists enregistrements_ajout on public.enregistrements;
create policy enregistrements_ajout on public.enregistrements for insert with check (public.est_membre());
drop policy if exists enregistrements_maj on public.enregistrements;
create policy enregistrements_maj on public.enregistrements for update using (public.est_membre());
-- Aucune politique DELETE : une fiche n'est jamais effacée par l'application (archivage).

-- ─── Journal des modifications (y compris les conflits) ─────────────────────
create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  entite text not null,
  row_id uuid not null,
  champ text not null,
  avant jsonb,
  apres jsonb,
  auteur uuid default auth.uid(),
  appareil text,
  at timestamptz not null default now(),
  conflit boolean not null default false,
  server_seq bigint not null default nextval('public.seq_sync')
);
create index if not exists journal_seq on public.journal (server_seq);
create index if not exists journal_fiche on public.journal (entite, row_id);

alter table public.journal enable row level security;
drop policy if exists journal_lecture on public.journal;
create policy journal_lecture on public.journal for select using (public.est_membre());
drop policy if exists journal_ajout on public.journal;
-- On ne peut pas écrire au journal au nom d'un collègue.
create policy journal_ajout on public.journal for insert with check (public.est_membre() and (auteur is null or auteur = auth.uid()));

-- ─── Envoi des modifications : fusion « dernière modification gagnante par champ » ──
-- ops = [{ entite, id, champs: {champ: valeur}, ts: {champ: horodatage HLC} }, …]
-- Retourne les champs refusés (une modification plus récente existe déjà sur le serveur) ;
-- chaque refus est inscrit au journal comme conflit : aucune perte silencieuse.
create or replace function public.sync_push(ops jsonb, appareil text default null) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  op jsonb;
  cle text;
  ts_entrant text;
  ts_actuel text;
  actuel public.enregistrements;
  v_donnees jsonb;
  v_ts jsonb;
  modifie boolean;
  rejets jsonb := '[]'::jsonb;
begin
  if not public.est_membre() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  for op in select * from jsonb_array_elements(ops) loop
    select * into actuel from public.enregistrements
      where entite = op ->> 'entite' and id = (op ->> 'id')::uuid
      for update;

    if not found then
      insert into public.enregistrements (entite, id, donnees, ts)
      values (op ->> 'entite', (op ->> 'id')::uuid, op -> 'champs', op -> 'ts');
      continue;
    end if;

    v_donnees := actuel.donnees;
    v_ts := actuel.ts;
    modifie := false;

    for cle in select jsonb_object_keys(op -> 'champs') loop
      ts_entrant := op -> 'ts' ->> cle;
      ts_actuel := v_ts ->> cle;
      if ts_actuel is null or ts_entrant > ts_actuel then
        v_donnees := jsonb_set(v_donnees, array[cle], op -> 'champs' -> cle, true);
        v_ts := jsonb_set(v_ts, array[cle], to_jsonb(ts_entrant), true);
        modifie := true;
      elsif ts_entrant < ts_actuel then
        -- La valeur reçue est plus ancienne : elle perd, mais elle est gardée au journal.
        insert into public.journal (entite, row_id, champ, avant, apres, appareil, conflit)
        values (op ->> 'entite', (op ->> 'id')::uuid, cle, op -> 'champs' -> cle, v_donnees -> cle, appareil, true);
        rejets := rejets || jsonb_build_object('entite', op ->> 'entite', 'id', op ->> 'id', 'champ', cle);
      end if;
      -- Horodatage identique : même modification renvoyée (réseau coupé) → ignorée.
    end loop;

    if modifie then
      update public.enregistrements
        set donnees = v_donnees, ts = v_ts, updated_at = now(), updated_by = auth.uid(),
            server_seq = nextval('public.seq_sync')
        where entite = actuel.entite and id = actuel.id;
    end if;
  end loop;

  return jsonb_build_object('rejets', rejets);
end $$;

grant usage on schema public to authenticated;
grant select, insert, update on public.enregistrements, public.journal, public.appareils to authenticated;
grant select, update on public.profils to authenticated;
grant usage on sequence public.seq_sync to authenticated;
grant execute on function public.sync_push(jsonb, text), public.est_membre(), public.est_admin() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Linkimmo — stockage des fichiers et temps réel (spécifique à Supabase)
-- À exécuter après 0001_schema.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Espace privé pour les documents et photos (accès réservé aux membres de l'agence).
insert into storage.buckets (id, name, public, file_size_limit)
values ('fichiers', 'fichiers', false, 26214400)
on conflict (id) do nothing;

drop policy if exists fichiers_lecture on storage.objects;
create policy fichiers_lecture on storage.objects for select
  using (bucket_id = 'fichiers' and public.est_membre());

drop policy if exists fichiers_ajout on storage.objects;
create policy fichiers_ajout on storage.objects for insert
  with check (bucket_id = 'fichiers' and public.est_membre());

-- Temps réel : prévenir les autres appareils dès qu'une fiche change.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'enregistrements') then
    alter publication supabase_realtime add table public.enregistrements;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'journal') then
    alter publication supabase_realtime add table public.journal;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'appareils') then
    alter publication supabase_realtime add table public.appareils;
  end if;
end $$;

-- ─── Notifications sur le téléphone (Web Push) ──────────────────────────────
-- Chaque appareil qui accepte les notifications enregistre ici son « abonnement ».
-- Une fonction du serveur (Edge Function « rappels-push »), lancée toutes les 5 minutes,
-- demande à rappels_a_envoyer() ce qui est dû, envoie les notifications et le note
-- dans notifications_envoyees (jamais deux fois la même).

create table if not exists public.abonnements_push (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  appareil text,
  created_at timestamptz not null default now(),
  maj_at timestamptz not null default now()
);
alter table public.abonnements_push enable row level security;
drop policy if exists abonnements_les_miens on public.abonnements_push;
create policy abonnements_les_miens on public.abonnements_push for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.est_membre());

-- Préférences de chacun (une ligne par utilisateur ; absente = valeurs par défaut).
create table if not exists public.preferences_notifications (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  relances boolean not null default true,
  rdv_minutes integer not null default 30 check (rdv_minutes between 0 and 1440),
  resume_matin boolean not null default true,
  heure_matin time not null default '08:30',
  week_end boolean not null default false,
  maj_at timestamptz not null default now()
);
alter table public.preferences_notifications enable row level security;
drop policy if exists preferences_les_miennes on public.preferences_notifications;
create policy preferences_les_miennes on public.preferences_notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.est_membre());

-- Notifications déjà envoyées (réservé au serveur : aucune politique = aucun accès depuis l'application).
create table if not exists public.notifications_envoyees (
  user_id uuid not null,
  cle text not null,
  envoye_at timestamptz not null default now(),
  primary key (user_id, cle)
);
alter table public.notifications_envoyees enable row level security;

grant select, insert, update, delete on public.abonnements_push, public.preferences_notifications to authenticated;

-- Nom lisible d'un contact (prénom nom, sinon société, sinon « un contact »).
create or replace function public.nom_contact(d jsonb) returns text language sql immutable as $$
  select coalesce(nullif(trim(concat_ws(' ', d->>'prenom', d->>'nom')), ''), nullif(d->>'societe', ''), 'un contact')
$$;

-- Adresse courte d'un bien (« Rue Puissant 7, Gilly »).
create or replace function public.adresse_bien(d jsonb) returns text language sql immutable as $$
  select coalesce(nullif(trim(concat_ws(', ',
    nullif(trim(concat_ws(' ', d->'adresse'->>'rue', d->'adresse'->>'numero')), ''),
    nullif(d->'adresse'->>'ville', ''))), ''), 'bien sans adresse')
$$;

-- Ce qui doit être envoyé maintenant, par utilisateur :
--   • relance : à l'heure prévue (fenêtre des dernières minutes) ;
--   • rdv : N minutes avant (préférence, 30 par défaut) ;
--   • matin : résumé de la journée à l'heure choisie (8 h 30 par défaut, heure de Bruxelles).
-- La personne concernée est le collaborateur attitré, à défaut celle qui a créé la fiche.
create or replace function public.rappels_a_envoyer(p_maintenant timestamptz default now(), p_fenetre interval default interval '10 minutes')
returns table (user_id uuid, cle text, titre text, corps text, url text)
language sql stable security definer set search_path = public as $$
  with prefs as (
    select p.id as user_id,
           coalesce(n.relances, true) as relances,
           coalesce(n.rdv_minutes, 30) as rdv_minutes,
           coalesce(n.resume_matin, true) as resume_matin,
           coalesce(n.heure_matin, '08:30') as heure_matin,
           coalesce(n.week_end, false) as week_end
    from profils p
    left join preferences_notifications n on n.user_id = p.id
    where p.actif and exists (select 1 from abonnements_push a where a.user_id = p.id)
  ),
  fiches as (
    select e.entite, e.id, e.donnees as d, coalesce((e.donnees->>'collaborateurId')::uuid, e.created_by) as pour, e.created_by as cree_par
    from enregistrements e
    where e.entite in ('contacts', 'pistes', 'evenements') and e.donnees->>'archivedAt' is null
  ),
  pistes_en_cours as (
    select f.id, f.d, f.pour, f.cree_par from fiches f
    where f.entite = 'pistes' and coalesce(f.d->>'statut', '') not in ('gagne', 'perdu')
  ),
  relances as (
    -- Contacts sans piste en cours (sinon c'est la piste qui porte la relance)
    select c.pour, 'relance:contacts:' || c.id || ':' || (c.d->>'prochaineRelanceAt') as cle,
           '📞 Relancer ' || nom_contact(c.d) as titre,
           coalesce('Téléphone : ' || (c.d->'telephones'->0->>'numero'), 'Prévue maintenant') as corps,
           '/contacts/' || c.id as url,
           (c.d->>'prochaineRelanceAt')::timestamptz as quand
    from fiches c
    where c.entite = 'contacts' and coalesce((c.d->>'nePasContacter')::boolean, false) = false
      and c.d->>'prochaineRelanceAt' is not null
      and not exists (select 1 from pistes_en_cours p where p.d->>'contactId' = c.id::text)
    union all
    -- Suivi par : celui de la piste, à défaut celui du propriétaire, à défaut l'auteur de la piste
    select coalesce((p.d->>'collaborateurId')::uuid, (pr.d->>'collaborateurId')::uuid, p.cree_par),
           'relance:pistes:' || p.id || ':' || (p.d->>'prochaineRelanceAt'),
           '📞 ' || case p.d->>'categorie' when 'maison_vide' then 'Maison vide' else 'Annonce' end || ' – ' || coalesce(adresse_bien(b.donnees), 'bien'),
           case when pr.id is null then 'Propriétaire encore inconnu' else 'Appeler ' || nom_contact(pr.d) end
             || coalesce(' · ' || (p.d->>'alerte'), ''),
           '/pistes/' || p.id,
           (p.d->>'prochaineRelanceAt')::timestamptz
    from pistes_en_cours p
    left join enregistrements b on b.entite = 'biens' and b.id::text = p.d->>'bienId'
    left join fiches pr on pr.entite = 'contacts' and pr.id::text = p.d->>'contactId'
    where p.d->>'prochaineRelanceAt' is not null
  ),
  rdv as (
    select f.pour, 'rdv:' || f.id || ':' || (f.d->>'debut') as cle,
           '📅 ' || coalesce(nullif(f.d->>'titre', ''), 'Rendez-vous') || ' à ' || to_char((f.d->>'debut')::timestamptz at time zone 'Europe/Brussels', 'HH24"h"MI') as titre,
           coalesce(nullif(f.d->>'lieu', ''), 'Rendez-vous') as corps,
           '/agenda' as url,
           (f.d->>'debut')::timestamptz as debut
    from fiches f
    where f.entite = 'evenements' and coalesce((f.d->>'journee')::boolean, false) = false
  ),
  dus as (
    select r.pour as user_id, r.cle, r.titre, r.corps, r.url
    from relances r join prefs p on p.user_id = r.pour
    where p.relances and r.quand <= p_maintenant and r.quand > p_maintenant - p_fenetre
    union all
    select r.pour, r.cle, r.titre, r.corps, r.url
    from rdv r join prefs p on p.user_id = r.pour
    where r.debut - make_interval(mins => p.rdv_minutes) <= p_maintenant
      and r.debut - make_interval(mins => p.rdv_minutes) > p_maintenant - p_fenetre
    union all
    -- Résumé du matin
    select p.user_id,
           'matin:' || to_char(p_maintenant at time zone 'Europe/Brussels', 'YYYY-MM-DD'),
           'Bonjour ! ' || concat_ws(', ',
             nullif(count(distinct r.cle) filter (where r.cle is not null), 0) || ' relance' || case when count(distinct r.cle) > 1 then 's' else '' end,
             nullif(count(distinct v.cle) filter (where v.cle is not null), 0) || ' rendez-vous') || ' aujourd’hui',
           'Ouvrez Linkimmo pour voir qui appeler en premier.',
           '/'
    from prefs p
    left join relances r on r.pour = p.user_id
      and (r.quand at time zone 'Europe/Brussels')::date <= (p_maintenant at time zone 'Europe/Brussels')::date
      and r.quand > p_maintenant - interval '30 days'
    left join rdv v on v.pour = p.user_id and (v.debut at time zone 'Europe/Brussels')::date = (p_maintenant at time zone 'Europe/Brussels')::date
    where p.resume_matin
      and (p_maintenant at time zone 'Europe/Brussels')::time >= p.heure_matin
      and (p_maintenant at time zone 'Europe/Brussels')::time < p.heure_matin + p_fenetre
      and (p.week_end or extract(isodow from p_maintenant at time zone 'Europe/Brussels') < 6)
    group by p.user_id
    having count(r.cle) + count(v.cle) > 0
  )
  select d.user_id, d.cle, d.titre, d.corps, d.url from dus d
  where not exists (select 1 from notifications_envoyees n where n.user_id = d.user_id and n.cle = d.cle)
$$;
revoke all on function public.rappels_a_envoyer(timestamptz, interval) from public;
revoke all on function public.rappels_a_envoyer(timestamptz, interval) from authenticated;

