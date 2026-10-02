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
           'Ouvrez Prospect’Immo pour voir qui appeler en premier.',
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
