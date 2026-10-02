-- Tests des notifications : qui reçoit quoi, quand, et jamais deux fois.
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000c', 'carla@exemple.be'),
  ('00000000-0000-0000-0000-00000000000d', 'dimitri@exemple.be'),
  ('00000000-0000-0000-0000-00000000000e', 'sans-notif@exemple.be');
-- Abonnements de Carla et Dimitri (pas du troisième)
insert into abonnements_push (endpoint, user_id, p256dh, auth) values
  ('https://push.exemple/c', '00000000-0000-0000-0000-00000000000c', 'k', 'a'),
  ('https://push.exemple/d', '00000000-0000-0000-0000-00000000000d', 'k', 'a');

-- Fiches (lundi 5 octobre 2026, 10 h à Bruxelles = 08:00 UTC)
insert into enregistrements (entite, id, donnees, created_by) values
  ('contacts', 'c0000000-0000-0000-0000-000000000001', '{"prenom":"Marc","nom":"Dupont","telephones":[{"numero":"0472 18 90 33"}],"prochaineRelanceAt":"2026-10-05T07:55:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('contacts', 'c0000000-0000-0000-0000-000000000002', '{"nom":"Plus tard","prochaineRelanceAt":"2026-10-05T08:30:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('contacts', 'c0000000-0000-0000-0000-000000000003', '{"nom":"Opposé","nePasContacter":true,"prochaineRelanceAt":"2026-10-05T07:55:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('contacts', 'c0000000-0000-0000-0000-000000000004', '{"nom":"Pour Dimitri","collaborateurId":"00000000-0000-0000-0000-00000000000d","prochaineRelanceAt":"2026-10-05T07:58:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('contacts', 'c0000000-0000-0000-0000-000000000005', '{"prenom":"Anna","nom":"Rossi","prochaineRelanceAt":"2026-10-05T07:55:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('contacts', 'c0000000-0000-0000-0000-000000000006', '{"nom":"Archivé","archivedAt":"2026-10-01","prochaineRelanceAt":"2026-10-05T07:55:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('biens', 'b0000000-0000-0000-0000-000000000001', '{"adresse":{"rue":"Rue Puissant","numero":"7","cp":"6060","ville":"Gilly"}}', '00000000-0000-0000-0000-00000000000c'),
  ('pistes', 'a0000000-0000-0000-0000-000000000001', '{"categorie":"maison_vide","statut":"en_cours","bienId":"b0000000-0000-0000-0000-000000000001","contactId":"c0000000-0000-0000-0000-000000000005","prochaineRelanceAt":"2026-10-05T07:56:00.000Z"}', '00000000-0000-0000-0000-00000000000c'),
  ('evenements', 'e0000000-0000-0000-0000-000000000001', '{"titre":"Estimation Dupont","lieu":"Chez M. Dupont","debut":"2026-10-05T08:25:00.000Z","journee":false}', '00000000-0000-0000-0000-00000000000c'),
  ('evenements', 'e0000000-0000-0000-0000-000000000002', '{"titre":"Visite","debut":"2026-10-05T12:00:00.000Z","journee":false}', '00000000-0000-0000-0000-00000000000c');

do $$
declare r record; n int;
begin
  -- 10 h : relance de Marc, relance de la piste (pas celle d'Anna en double), RDV dans 30 min ; Dimitri : sa relance
  select count(*) into n from rappels_a_envoyer('2026-10-05 08:00:00+00') where user_id = '00000000-0000-0000-0000-00000000000c';
  assert n = 3, format('Carla devrait recevoir 3 notifications, reçu %s', n);
  select * into r from rappels_a_envoyer('2026-10-05 08:00:00+00') where cle like 'relance:pistes:%';
  assert r.titre = '📞 Maison vide – Rue Puissant 7, Gilly', r.titre;
  assert r.corps = 'Appeler Anna Rossi', r.corps;
  assert r.url = '/pistes/a0000000-0000-0000-0000-000000000001';
  select * into r from rappels_a_envoyer('2026-10-05 08:00:00+00') where cle like 'rdv:%';
  assert r.titre = '📅 Estimation Dupont à 10h25', r.titre;
  select * into r from rappels_a_envoyer('2026-10-05 08:00:00+00') where cle like 'relance:contacts:c0000000-0000-0000-0000-000000000001%';
  assert r.titre = '📞 Relancer Marc Dupont' and r.corps = 'Téléphone : 0472 18 90 33', r.titre || ' / ' || r.corps;
  select count(*) into n from rappels_a_envoyer('2026-10-05 08:00:00+00') where user_id = '00000000-0000-0000-0000-00000000000d';
  assert n = 1, 'Dimitri reçoit la relance qui lui est attribuée';
  select count(*) into n from rappels_a_envoyer('2026-10-05 08:00:00+00') where user_id = '00000000-0000-0000-0000-00000000000e';
  assert n = 0, 'sans abonnement : rien';
end $$;

-- Une fois envoyées, plus jamais renvoyées
insert into notifications_envoyees (user_id, cle) select user_id, cle from rappels_a_envoyer('2026-10-05 08:00:00+00');
do $$ begin
  assert (select count(*) from rappels_a_envoyer('2026-10-05 08:02:00+00')) = 0, 'aucun doublon';
end $$;
-- Relance déplacée : nouvelle notification à la nouvelle heure
update enregistrements set donnees = jsonb_set(donnees, '{prochaineRelanceAt}', '"2026-10-05T09:00:00.000Z"') where id = 'c0000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from rappels_a_envoyer('2026-10-05 09:03:00+00') where cle like 'relance:contacts:c0000000-0000-0000-0000-000000000001%') = 1;
end $$;

-- Résumé du matin (8 h 32 à Bruxelles)
do $$
declare r record;
begin
  select * into r from rappels_a_envoyer('2026-10-05 06:32:00+00') where user_id = '00000000-0000-0000-0000-00000000000c' and cle like 'matin:%';
  assert r.titre = 'Bonjour ! 3 relances, 2 rendez-vous aujourd’hui', r.titre;
  assert r.cle = 'matin:2026-10-05';
  assert (select count(*) from rappels_a_envoyer('2026-10-05 06:20:00+00') where cle like 'matin:%') = 0, 'pas avant 8 h 30';
  assert (select count(*) from rappels_a_envoyer('2026-10-10 06:32:00+00') where cle like 'matin:%') = 0, 'pas le week-end';
end $$;

-- Préférences : Dimitri coupe les relances et veut le résumé le week-end
insert into preferences_notifications (user_id, relances, week_end) values ('00000000-0000-0000-0000-00000000000d', false, true);
update enregistrements set donnees = jsonb_set(donnees, '{prochaineRelanceAt}', '"2026-10-10T06:30:00.000Z"') where id = 'c0000000-0000-0000-0000-000000000004';
do $$ begin
  assert (select count(*) from rappels_a_envoyer('2026-10-10 06:32:00+00') where cle like 'relance:%' and user_id = '00000000-0000-0000-0000-00000000000d') = 0, 'relances coupées';
  assert (select count(*) from rappels_a_envoyer('2026-10-10 06:32:00+00') where cle like 'matin:%' and user_id = '00000000-0000-0000-0000-00000000000d') = 1, 'résumé le samedi';
end $$;

-- Sécurité : chacun ne voit que ses abonnements ; le reste est réservé au serveur
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
insert into abonnements_push (endpoint, p256dh, auth) values ('https://push.exemple/c2', 'k', 'a');
do $$ begin
  assert (select count(*) from abonnements_push) = 2, 'Carla voit ses 2 abonnements, pas celui de Dimitri';
  begin
    perform count(*) from notifications_envoyees;
    raise exception 'journal des envois lisible depuis l''application';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into abonnements_push (endpoint, user_id, p256dh, auth) values ('https://push.exemple/pirate', '00000000-0000-0000-0000-00000000000d', 'k', 'a');
    raise exception 'abonnement au nom d''un autre accepté';
  exception when insufficient_privilege then null;
  end;
  begin
    perform rappels_a_envoyer();
    raise exception 'rappels_a_envoyer ne doit pas être accessible';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select '✅ Tests des notifications passés.';
