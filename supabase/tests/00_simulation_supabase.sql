-- Simulation minimale de Supabase pour tester le schéma sur un PostgreSQL local :
-- schéma auth, fonction auth.uid() et rôle « authenticated ».
drop schema if exists auth cascade;
drop schema if exists public cascade;
create schema public;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
