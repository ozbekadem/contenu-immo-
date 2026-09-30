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
