-- Tests du schéma : profils, sécurité par rôle et fusion champ par champ.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'adem@exemple.be'),
  ('00000000-0000-0000-0000-00000000000b', 'secretaire@exemple.be');

do $$ begin
  assert (select role from profils where email = 'adem@exemple.be') = 'admin', 'le premier utilisateur doit être admin';
  assert (select role from profils where email = 'secretaire@exemple.be') = 'collaborateur', 'les suivants sont collaborateurs';
end $$;

-- Sans connexion : aucun accès
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from enregistrements) = 0;
  begin
    perform sync_push('[]'::jsonb);
    raise exception 'sync_push aurait dû être refusé';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Appareil A (Adem) crée un contact
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select sync_push('[{"entite":"contacts","id":"11111111-1111-1111-1111-111111111111",
  "champs":{"nom":"Dupont","telephone":"+32472189033","ville":"Jumet"},
  "ts":{"nom":"000000000001000-00000-A","telephone":"000000000001000-00000-A","ville":"000000000001000-00000-A"}}]', 'A');

-- Appareil B (secrétaire), hors ligne, modifie la ville plus tard ; A modifie le téléphone
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select sync_push('[{"entite":"contacts","id":"11111111-1111-1111-1111-111111111111",
  "champs":{"ville":"Gosselies"},"ts":{"ville":"000000000003000-00000-B"}}]', 'B');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select sync_push('[{"entite":"contacts","id":"11111111-1111-1111-1111-111111111111",
  "champs":{"telephone":"+32499000000"},"ts":{"telephone":"000000000002000-00000-A"}}]', 'A');

do $$
declare d jsonb;
begin
  select donnees into d from enregistrements where id = '11111111-1111-1111-1111-111111111111';
  assert d ->> 'ville' = 'Gosselies', 'modification de B conservée';
  assert d ->> 'telephone' = '+32499000000', 'modification de A conservée (champ différent)';
  assert d ->> 'nom' = 'Dupont';
end $$;

-- A envoie une ancienne valeur de ville (modifiée hors ligne AVANT B) : elle perd, mais est journalisée
select sync_push('[{"entite":"contacts","id":"11111111-1111-1111-1111-111111111111",
  "champs":{"ville":"Charleroi"},"ts":{"ville":"000000000002500-00000-A"}}]', 'A') as resultat \gset
do $$
declare d jsonb;
begin
  select donnees into d from enregistrements where id = '11111111-1111-1111-1111-111111111111';
  assert d ->> 'ville' = 'Gosselies', 'la valeur la plus récente gagne';
  assert (select count(*) from journal where conflit and champ = 'ville' and avant = '"Charleroi"' and apres = '"Gosselies"') = 1,
    'la valeur perdante est inscrite au journal (aucune perte silencieuse)';
end $$;
\echo 'Résultat du conflit : ' :resultat

-- Renvoi identique (coupure réseau après envoi) : aucun effet, pas de doublon
select server_seq as seq_avant from enregistrements where id = '11111111-1111-1111-1111-111111111111' \gset
select sync_push('[{"entite":"contacts","id":"11111111-1111-1111-1111-111111111111",
  "champs":{"telephone":"+32499000000"},"ts":{"telephone":"000000000002000-00000-A"}}]', 'A');
do $$ begin
  assert (select count(*) from enregistrements) = 1;
  assert (select count(*) from journal where conflit) = 1;
end $$;
select (server_seq = :seq_avant) as seq_inchangee from enregistrements where id = '11111111-1111-1111-1111-111111111111' \gset
\if :seq_inchangee
\else
  \echo 'ÉCHEC : le renvoi identique a modifié la fiche'
  select 1/0;
\endif

-- Réception : « ce qui a changé depuis le n° X »
do $$ begin
  assert (select count(*) from enregistrements where server_seq > 0) = 1;
end $$;

-- Suppression interdite
do $$ begin
  begin
    delete from enregistrements;
  exception when insufficient_privilege then null; -- refus par les droits (PostgreSQL local)
  end;
  assert (select count(*) from enregistrements) = 1, 'aucune suppression possible';
end $$;

-- Un compte désactivé perd l'accès immédiatement
reset role;
update profils set actif = false where email = 'secretaire@exemple.be';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from enregistrements) = 0, 'compte désactivé : plus rien de visible';
end $$;

-- Appareils : un collaborateur ne voit que les siens, l'admin voit tout
reset role;
update profils set actif = true where email = 'secretaire@exemple.be';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into appareils (id, nom) values ('B', 'iPhone secrétaire');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into appareils (id, nom) values ('A', 'Android Adem');
do $$ begin
  assert (select count(*) from appareils) = 2, 'admin voit tous les appareils';
end $$;
update appareils set revoque = true, revoque_le = now() where id = 'B';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from appareils) = 1, 'collaborateur ne voit que ses appareils';
  assert (select revoque from appareils where id = 'B'), 'appareil B déconnecté à distance par l''admin';
end $$;

-- L'appareil B ne peut pas annuler sa propre déconnexion
do $$ begin
  begin
    update appareils set revoque = false where id = 'B';
    raise exception 'la réactivation aurait dû être refusée';
  exception when insufficient_privilege then null;
  end;
  assert (select revoque from appareils where id = 'B');
end $$;

-- Journal : impossible d'écrire au nom d'un collègue
do $$ begin
  begin
    insert into journal (entite, row_id, champ, auteur) values ('contacts', gen_random_uuid(), 'nom', '00000000-0000-0000-0000-00000000000a');
    raise exception 'écriture au nom d''un autre aurait dû être refusée';
  exception when insufficient_privilege then null;
  end;
  insert into journal (entite, row_id, champ, auteur) values ('contacts', gen_random_uuid(), 'nom', '00000000-0000-0000-0000-00000000000b');
end $$;

\echo '✅ Tous les tests SQL sont passés.'
