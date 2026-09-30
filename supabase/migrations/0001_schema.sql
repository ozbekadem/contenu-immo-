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
