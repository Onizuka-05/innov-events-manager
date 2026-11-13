-- CO-04 — TESTS DES CONTRAINTES (PostgreSQL)
-- A lancer apres CO-04-script-postgresql.sql :
--   psql -v ON_ERROR_STOP=1 -q -f CO-04-tests-contraintes.sql
-- Le compte qui lance les tests doit pouvoir prendre le role innov_events_app
-- (superutilisateur, ou membre du role : GRANT innov_events_app TO <compte>).
-- Tout s'execute dans une transaction annulee a la fin : la base reste vide.
-- Chaque ligne "OK" est un test reussi ; le premier "ECHEC" arrete le script.

BEGIN;

-- Donnees de reference, inserees par le proprietaire comme le fera le jeu d'essai.
INSERT INTO innov_events.types_evenement (libelle) VALUES ('Gala'), ('Seminaire');
INSERT INTO innov_events.themes (libelle) VALUES ('Annees folles');
INSERT INTO innov_events.parametres (texte_remerciement, taux_tva_defaut) VALUES ('Merci', 20);

SET LOCAL ROLE innov_events_app;
SET LOCAL search_path = innov_events;

-- ok : doit reussir ; ko : doit echouer avec le code SQLSTATE attendu ; eq : resultat attendu
CREATE PROCEDURE pg_temp.ko(d text, q text, etat text) LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN others THEN
    IF SQLSTATE = etat THEN RAISE NOTICE 'OK  (refus attendu) %', d; RETURN; END IF;
    RAISE EXCEPTION 'ECHEC % : erreur inattendue % %', d, SQLSTATE, SQLERRM; END;
  RAISE EXCEPTION 'ECHEC % : aurait du etre refuse', d;
END $$;
CREATE PROCEDURE pg_temp.ok(d text, q text) LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RAISE NOTICE 'OK  %', d; END $$;
CREATE PROCEDURE pg_temp.eq(d text, q text, attendu text) LANGUAGE plpgsql AS $$
DECLARE r text; BEGIN EXECUTE q INTO r;
  IF r IS DISTINCT FROM attendu THEN RAISE EXCEPTION 'ECHEC % : % au lieu de %', d, r, attendu; END IF;
  RAISE NOTICE 'OK  %', d; END $$;

-- 1. Droits du role applicatif
CALL pg_temp.ko('le role applicatif ne peut pas modifier les types', $q$INSERT INTO types_evenement(libelle) VALUES ('x')$q$, '42501');
CALL pg_temp.ko('le role applicatif ne peut pas creer de table', $q$CREATE TABLE t(x int)$q$, '42501');
CALL pg_temp.ok('le role applicatif modifie les parametres', $q$UPDATE parametres SET texte_remerciement='Merci !'$q$);

-- 2. Utilisateurs
CALL pg_temp.ok('insertion avec identite sans GRANT sur sequence', $q$INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,mot_de_passe_hache,role) VALUES ('Ana@x.fr','ana','Ana','Durand','h1','client')$q$);
CALL pg_temp.ko('id impose refuse (ALWAYS)', $q$INSERT INTO utilisateurs(id_utilisateur,email_connexion,nom_utilisateur,prenom,nom,mot_de_passe_hache,role) VALUES (99,'b@x.fr','b','B','B','h','client')$q$, '428C9');
CALL pg_temp.ko('email unique sans tenir compte de la casse', $q$INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,mot_de_passe_hache,role) VALUES ('ana@X.FR','ana2','A','D','h','client')$q$, '23505');
CALL pg_temp.ko('role inconnu refuse', $q$INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,mot_de_passe_hache,role) VALUES ('c@x.fr','c','C','C','h','administrateur')$q$, '23514');
CALL pg_temp.ok('mdp oublie : temporaire ajoute, ancien conserve', $q$UPDATE utilisateurs SET mdp_temporaire_hache='t', mdp_temporaire_expire_le=now()+interval '15 min' WHERE nom_utilisateur='ana'$q$);
CALL pg_temp.ko('temporaire sans expiration refuse', $q$UPDATE utilisateurs SET mdp_temporaire_expire_le=NULL WHERE nom_utilisateur='ana'$q$, '23514');
CALL pg_temp.ok('compte auto-cree avec seulement un temporaire', $q$INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,mdp_temporaire_hache,mdp_temporaire_expire_le,role) VALUES ('leo@x.fr','leo','Leo','Martin','t',now()+interval '1 day','client')$q$);
CALL pg_temp.ko('compte actif sans aucun mot de passe refuse', $q$INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,role) VALUES ('z@x.fr','z','Z','Z','client')$q$, '23514');
CALL pg_temp.ko('suppression logique interdite pour un client', $q$UPDATE utilisateurs SET statut_compte='supprime', mot_de_passe_hache=NULL, mdp_temporaire_hache=NULL, mdp_temporaire_expire_le=NULL WHERE nom_utilisateur='ana'$q$, '23514');
INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,mot_de_passe_hache,role) VALUES ('jose@x.fr','jose','Jose','Employe','h','employe');
INSERT INTO utilisateurs(email_connexion,nom_utilisateur,prenom,nom,mot_de_passe_hache,role) VALUES ('chloe@x.fr','chloe','Chloe','Admin','h','admin');
CALL pg_temp.ko('compte supprime avec mot de passe refuse', $q$UPDATE utilisateurs SET statut_compte='supprime' WHERE nom_utilisateur='jose'$q$, '23514');

-- 3. Clients
INSERT INTO clients(id_utilisateur,entreprise,nom_contact,prenom_contact,email_contact,telephone) SELECT id_utilisateur,'Acme','Durand','Ana','ana@x.fr','0600000000' FROM utilisateurs WHERE nom_utilisateur='ana';
CALL pg_temp.ko('client sans telephone refuse', $q$INSERT INTO clients(entreprise,nom_contact,prenom_contact,email_contact) VALUES ('B','b','b','b@x.fr')$q$, '23514');
CALL pg_temp.ko('anonymisation partielle refusee', $q$UPDATE clients SET date_anonymisation=now(), nom_contact=NULL WHERE entreprise='Acme'$q$, '23514');

-- 4. Prospects
INSERT INTO prospects(id_type_evenement,entreprise,nom,prenom,email,telephone,lieu_souhaite,date_souhaitee,nb_participants,description_besoin)
  VALUES ((SELECT id_type_evenement FROM types_evenement WHERE libelle='Gala'),'Acme','Durand','Ana','ana@x.fr','0600000000','Lyon','2026-12-01',80,'Gala annuel');
CALL pg_temp.ko('converti sans client refuse', $q$UPDATE prospects SET statut_prospect='converti'$q$, '23514');
CALL pg_temp.ko('client rattache sans conversion refuse', $q$UPDATE prospects SET id_client=(SELECT id_client FROM clients LIMIT 1)$q$, '23514');
CALL pg_temp.ko('echoue sans date de dernier contact refuse', $q$UPDATE prospects SET statut_prospect='echoue'$q$, '23514');
CALL pg_temp.eq('date_dernier_contact vide a la creation', $q$SELECT (date_dernier_contact IS NULL)::text FROM prospects$q$, 'true');
CALL pg_temp.ok('conversion', $q$UPDATE prospects SET statut_prospect='converti', id_client=(SELECT id_client FROM clients LIMIT 1)$q$);

-- 5. Evenements et publication
INSERT INTO evenements(id_client,id_prospect,id_type_evenement,id_theme,nom,date_debut,date_fin,lieu,statut_evenement,date_accord_publication,visible_public)
  SELECT c.id_client, p.id_prospect, (SELECT id_type_evenement FROM types_evenement WHERE libelle='Gala'), (SELECT id_theme FROM themes LIMIT 1), 'Gala', '2026-12-01 18:00+01','2026-12-01 23:00+01','Lyon','accepte',now(),true FROM clients c, prospects p;
CALL pg_temp.ok('le client retire son accord (visible_public reste coche)', $q$UPDATE evenements SET date_accord_publication=NULL$q$);
CALL pg_temp.ko('dates incoherentes refusees', $q$UPDATE evenements SET date_fin=date_debut$q$, '23514');
CALL pg_temp.ko('un prospect ne donne qu un evenement', $q$INSERT INTO evenements(id_client,id_prospect,id_type_evenement,nom,date_debut,date_fin,lieu) SELECT id_client,id_prospect,id_type_evenement,'Bis','2026-12-02','2026-12-03','Lyon' FROM evenements$q$, '23505');

-- 6. Devis : formules alternatives, modification sur place, un seul accepte
INSERT INTO devis(id_evenement,intitule,taux_tva_applique) SELECT id_evenement,'Formule economique',20 FROM evenements;
CALL pg_temp.ok('formule alternative acceptee en parallele', $q$INSERT INTO devis(id_evenement,intitule,taux_tva_applique) SELECT id_evenement,'Formule premium',20 FROM evenements$q$);
CALL pg_temp.ko('envoye sans date_envoi refuse', $q$UPDATE devis SET statut_devis='etude_client'$q$, '23514');
UPDATE devis SET statut_devis='etude_client', date_envoi=now();
CALL pg_temp.ko('modification sans motif refusee', $q$UPDATE devis SET statut_devis='modification' WHERE intitule='Formule premium'$q$, '23514');
CALL pg_temp.ko('motif sans date de modification refuse', $q$UPDATE devis SET statut_devis='modification', motif_modification='Moins cher' WHERE intitule='Formule premium'$q$, '23514');
CALL pg_temp.ok('demande de modification', $q$UPDATE devis SET statut_devis='modification', motif_modification='Moins cher', date_modification=now() WHERE intitule='Formule premium'$q$);
CALL pg_temp.ok('contre-proposition sur place, dernier motif conserve', $q$UPDATE devis SET statut_devis='etude_client', date_envoi=now() WHERE intitule='Formule premium'$q$);
CALL pg_temp.ok('acceptation et refus automatique des autres devis ouverts', $q$UPDATE devis SET statut_devis = CASE WHEN intitule='Formule premium' THEN 'accepte' ELSE 'refuse' END$q$);
CALL pg_temp.ko('deux devis acceptes refuses', $q$UPDATE devis SET statut_devis='accepte' WHERE intitule='Formule economique'$q$, '23505');

-- 7. Lignes : permutation de l'ordre dans une transaction
INSERT INTO devis(id_evenement,intitule,taux_tva_applique) SELECT id_evenement,'Brouillon interne',20 FROM evenements;
INSERT INTO lignes_devis(id_devis,libelle_prestation,montant_ht,ordre_affichage) SELECT id_devis,'Salle',1000,1 FROM devis WHERE intitule='Brouillon interne';
INSERT INTO lignes_devis(id_devis,libelle_prestation,montant_ht,ordre_affichage) SELECT id_devis,'Traiteur',2500,2 FROM devis WHERE intitule='Brouillon interne';
CALL pg_temp.ok('permutation de deux lignes', $q$UPDATE lignes_devis SET ordre_affichage = 3 - ordre_affichage; SET CONSTRAINTS uq_lignes_ordre_par_devis IMMEDIATE$q$);
SET CONSTRAINTS uq_lignes_ordre_par_devis DEFERRED;
CALL pg_temp.ko('ordre en double refuse a la verification', $q$UPDATE lignes_devis SET ordre_affichage = 1; SET CONSTRAINTS uq_lignes_ordre_par_devis IMMEDIATE$q$, '23505');
SET CONSTRAINTS uq_lignes_ordre_par_devis DEFERRED;
CALL pg_temp.eq('ordre permute', $q$SELECT string_agg(libelle_prestation, ',' ORDER BY ordre_affichage) FROM lignes_devis$q$, 'Traiteur,Salle');
CALL pg_temp.ok('suppression d un devis en preparation supprime ses lignes', $q$DELETE FROM devis WHERE intitule='Brouillon interne'$q$);
CALL pg_temp.eq('lignes supprimees', $q$SELECT count(*)::text FROM lignes_devis$q$, '0');

-- 8. Collaboration et suppression logique d'un employe
INSERT INTO taches(id_utilisateur,id_evenement,titre) SELECT u.id_utilisateur, e.id_evenement, 'Reserver la salle' FROM utilisateurs u, evenements e WHERE u.nom_utilisateur='jose';
INSERT INTO taches(id_utilisateur,id_evenement,titre,statut_tache) SELECT u.id_utilisateur, e.id_evenement, 'Visiter le lieu','termine' FROM utilisateurs u, evenements e WHERE u.nom_utilisateur='jose';
INSERT INTO notes(id_utilisateur,id_evenement,contenu) SELECT u.id_utilisateur, e.id_evenement, 'Client tres reactif' FROM utilisateurs u, evenements e WHERE u.nom_utilisateur='jose';
INSERT INTO notes(id_utilisateur,contenu) SELECT id_utilisateur, 'Note globale' FROM utilisateurs WHERE nom_utilisateur='chloe';
INSERT INTO avis(id_evenement,commentaire,note_evaluation) SELECT id_evenement,'Parfait',5 FROM evenements;
CALL pg_temp.ko('note sans auteur refusee', $q$INSERT INTO notes(contenu) VALUES ('anonyme')$q$, '23502');
CALL pg_temp.ko('note hors 1..5 refusee', $q$UPDATE avis SET note_evaluation=6$q$, '23514');
CALL pg_temp.ko('deuxieme avis refuse', $q$INSERT INTO avis(id_evenement,commentaire,note_evaluation) SELECT id_evenement,'Bis',4 FROM evenements$q$, '23505');
CALL pg_temp.ko('suppression physique d un employe refusee', $q$DELETE FROM utilisateurs WHERE nom_utilisateur='jose'$q$, '23503');
CALL pg_temp.ok('reaffectation des taches en cours a l admin', $q$UPDATE taches SET id_utilisateur=(SELECT id_utilisateur FROM utilisateurs WHERE nom_utilisateur='chloe') WHERE statut_tache<>'termine' AND id_utilisateur=(SELECT id_utilisateur FROM utilisateurs WHERE nom_utilisateur='jose')$q$);
CALL pg_temp.eq('taches : 1 reaffectee, 1 terminee restee a l employe', $q$SELECT string_agg(u.nom_utilisateur||':'||t.titre, ', ' ORDER BY t.titre) FROM taches t JOIN utilisateurs u USING (id_utilisateur)$q$, 'chloe:Reserver la salle, jose:Visiter le lieu');
CREATE TEMP TABLE id_jose AS SELECT id_utilisateur FROM utilisateurs WHERE nom_utilisateur='jose';
CALL pg_temp.ok('suppression logique de l employe', $q$SELECT supprimer_compte_employe((SELECT id_utilisateur FROM id_jose))$q$);
CALL pg_temp.eq('identite anonymisee, mots de passe effaces', $q$SELECT (statut_compte='supprime' AND email_connexion='supprime-'||id_utilisateur||'@compte.invalid' AND nom_utilisateur='supprime-'||id_utilisateur AND mot_de_passe_hache IS NULL AND mdp_temporaire_hache IS NULL)::text FROM utilisateurs WHERE id_utilisateur=(SELECT id_utilisateur FROM id_jose)$q$, 'true');
CALL pg_temp.eq('sa note et sa tache terminee restent rattachees', $q$SELECT (SELECT count(*) FROM notes WHERE id_utilisateur=(SELECT id_utilisateur FROM id_jose))||'/'||(SELECT count(*) FROM taches WHERE id_utilisateur=(SELECT id_utilisateur FROM id_jose))$q$, '1/1');
CALL pg_temp.ko('fonction employe refusee sur un compte client', $q$SELECT supprimer_compte_employe((SELECT id_utilisateur FROM utilisateurs WHERE nom_utilisateur='leo'))$q$, '23514');
CALL pg_temp.ko('fonction employe refusee sur le compte admin', $q$SELECT supprimer_compte_employe((SELECT id_utilisateur FROM utilisateurs WHERE nom_utilisateur='chloe'))$q$, '23514');

-- 9. RGPD : suppression du compte client
CALL pg_temp.ok('suppression du compte client', $q$SELECT supprimer_compte_client((SELECT id_client FROM clients WHERE entreprise='Acme'))$q$);
CALL pg_temp.eq('compte efface', $q$SELECT count(*)::text FROM utilisateurs WHERE nom_utilisateur='ana'$q$, '0');
CALL pg_temp.eq('fiche client anonymisee', $q$SELECT (date_anonymisation IS NOT NULL AND entreprise IS NULL AND email_contact IS NULL AND id_utilisateur IS NULL)::text FROM clients$q$, 'true');
CALL pg_temp.eq('demande de devis du client supprimee', $q$SELECT count(*)::text FROM prospects$q$, '0');
CALL pg_temp.eq('notes de ses evenements supprimees, note globale gardee', $q$SELECT string_agg(contenu, ',') FROM notes$q$, 'Note globale');
CALL pg_temp.eq('evenement, devis et avis conserves', $q$SELECT (SELECT count(*) FROM evenements)||'/'||(SELECT count(*) FROM devis)||'/'||(SELECT count(*) FROM avis)$q$, '1/2/1');

-- 10. Suppressions d'evenements et de clients
CALL pg_temp.ko('evenement avec devis non supprimable', $q$DELETE FROM evenements$q$, '23503');
CALL pg_temp.ko('client avec evenements non supprimable', $q$DELETE FROM clients$q$, '23503');
CALL pg_temp.ok('suppression evenement sans devis', $q$DELETE FROM devis; DELETE FROM evenements$q$);
CALL pg_temp.eq('taches et avis de l evenement supprimes', $q$SELECT (SELECT count(*) FROM taches)||'/'||(SELECT count(*) FROM avis)$q$, '0/0');
INSERT INTO clients(entreprise,nom_contact,prenom_contact,email_contact,telephone) VALUES ('Beta','Roy','Lea','lea@x.fr','0700000000');
INSERT INTO prospects(id_client,statut_prospect,id_type_evenement,entreprise,nom,prenom,email,telephone,lieu_souhaite,date_souhaitee,nb_participants,description_besoin)
  SELECT id_client,'converti',(SELECT id_type_evenement FROM types_evenement WHERE libelle='Seminaire'),'Beta','Roy','Lea','lea@x.fr','0700000000','Paris','2027-03-10',30,'Seminaire' FROM clients WHERE entreprise='Beta';
CALL pg_temp.ok('suppression d un client sans evenement', $q$DELETE FROM clients WHERE entreprise='Beta'$q$);
CALL pg_temp.eq('ses demandes de devis supprimees avec lui', $q$SELECT count(*)::text FROM prospects$q$, '0');

-- 11. Sessions (structure connect-pg-simple)
CALL pg_temp.ok('session ecrite', $q$INSERT INTO sessions VALUES ('abc','{"cookie":{}}', now()+interval '1 day')$q$);

\echo 'TOUS LES TESTS PASSENT'
ROLLBACK;
