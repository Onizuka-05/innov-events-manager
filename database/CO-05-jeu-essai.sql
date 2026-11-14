-- CO-05 - JEU D'ESSAI LOCAL / TEST UNIQUEMENT (jamais en production).
-- Reference : CO-04 (MLD et script SQL) et regles metier du dossier de conception.
-- Prerequis : base neuve sur laquelle CO-04 a ete execute, PostgreSQL 16.
-- Execution via psql avec une variable de hachage distincte par compte.
-- Les valeurs fournies doivent etre de vrais hachages Argon2id (algorithme retenu par l API).
-- Aucune cle GENERATED ALWAYS AS IDENTITY n'est renseignee manuellement.
-- Une nouvelle base doit etre utilisee pour chaque execution de CO-05.

BEGIN;

-- Referentiels et parametres (remplissage par le proprietaire du schema, pas par l utilisateur applicatif).
INSERT INTO innov_events.types_evenement (libelle)
VALUES ('Gala'), ('Seminaire'), ('Salon'), ('Conference'), ('Ceremonie');

INSERT INTO innov_events.themes (libelle)
VALUES ('Professionnel'), ('Culturel'), ('Solidaire');

INSERT INTO innov_events.parametres (texte_remerciement, taux_tva_defaut)
VALUES ('Votre demande a bien ete recue. Notre equipe vous recontactera.', 20.00);

-- Comptes : trois roles ; actif, suspendu et supprime (suppression d employe plus bas).
-- Le compte admin n'est cree ICI que pour une base de demonstration (en vrai : script dedie uniquement).
-- Le compte client_auto utilise un mot de passe temporaire stocke a part (compte cree a l envoi du devis).
INSERT INTO innov_events.utilisateurs
    (email_connexion, nom_utilisateur, prenom, nom,
     mot_de_passe_hache, mdp_temporaire_hache, mdp_temporaire_expire_le,
     role, statut_compte)
VALUES
    ('chloe.demo@example.org', 'chloe_demo', 'Chloe', 'Demo',
     :'hash_admin', NULL, NULL, 'admin', 'actif'),
    ('jose.demo@example.org', 'jose_demo', 'Jose', 'Demo',
     :'hash_employe', NULL, NULL, 'employe', 'actif'),
    ('ancien.employe@example.org', 'ancien_employe', 'Alex', 'Demo',
     :'hash_ancien_employe', NULL, NULL, 'employe', 'actif'),
    ('client.principal@example.org', 'client_principal', 'Camille', 'Demo',
     :'hash_client', NULL, NULL, 'client', 'actif'),
    ('client.suspendu@example.org', 'client_suspendu', 'Morgan', 'Demo',
     :'hash_suspendu', NULL, NULL, 'client', 'suspendu'),
    ('client.effacer@example.org', 'client_effacer', 'Lou', 'Demo',
     :'hash_effacer', NULL, NULL, 'client', 'actif'),
    ('client.auto@example.org', 'client_auto', 'Nina', 'Demo',
     NULL, :'hash_temporaire', NOW() + INTERVAL '7 days', 'client', 'actif');

-- Les fiches clients ont leur propre identite de contact, distincte du compte utilisateur.
-- Adresses et telephones sont manifestement fictifs.
INSERT INTO innov_events.clients
    (id_utilisateur, entreprise, nom_contact, prenom_contact,
     email_contact, telephone, adresse_postale)
SELECT u.id_utilisateur, d.entreprise, d.nom_contact, d.prenom_contact,
       d.email_contact, d.telephone, d.adresse_postale
FROM (VALUES
    ('client_principal', 'Atelier Demonstration', 'Exemple', 'Camille',
     'contact.principal@example.org', '00 00 00 00 00', '0 rue Fictive, 00000 Ville Exemple'),
    ('client_suspendu', 'Agence Suspendue', 'Exemple', 'Morgan',
     'contact.suspendu@example.org', '00 00 00 00 00', '0 rue Fictive, 00000 Ville Exemple'),
    ('client_effacer', 'Structure Effacable', 'Exemple', 'Lou',
     'contact.effacer@example.org', '00 00 00 00 00', '0 rue Fictive, 00000 Ville Exemple'),
    ('client_auto', 'Collectif Demonstration', 'Exemple', 'Nina',
     'contact.auto@example.org', '00 00 00 00 00', '0 rue Fictive, 00000 Ville Exemple')
) AS d(utilisateur, entreprise, nom_contact, prenom_contact,
       email_contact, telephone, adresse_postale)
JOIN innov_events.utilisateurs u ON u.nom_utilisateur = d.utilisateur;

-- Prospects : a_contacter, echoue (date de contact obligatoire), converti.
-- Un prospect converti porte obligatoirement une cle de client (CO-04).
WITH donnees(entreprise, client, type_evenement, nom, prenom, email,
             lieu, date_souhaitee, participants, besoin, statut, dernier_contact) AS (
    VALUES
    ('Atelier Demonstration', 'Atelier Demonstration', 'Gala', 'Exemple', 'Camille',
     'contact.principal@example.org', 'Lieu fictif A', DATE '2027-03-10', 120,
     'Organisation d un gala de demonstration', 'converti', NOW() - INTERVAL '10 days'),
    ('Agence Suspendue', 'Agence Suspendue', 'Seminaire', 'Exemple', 'Morgan',
     'contact.suspendu@example.org', 'Lieu fictif B', DATE '2026-11-12', 35,
     'Organisation d une formation', 'converti', NOW() - INTERVAL '20 days'),
    ('Structure Effacable', 'Structure Effacable', 'Ceremonie', 'Exemple', 'Lou',
     'contact.effacer@example.org', 'Lieu fictif C', DATE '2026-10-10', 50,
     'Evenement historique avant effacement', 'converti', NOW() - INTERVAL '40 days'),
    ('Collectif Demonstration', 'Collectif Demonstration', 'Salon', 'Exemple', 'Nina',
     'contact.auto@example.org', 'Lieu fictif D', DATE '2027-01-20', 70,
     'Salon de demonstration', 'converti', NOW() - INTERVAL '3 days'),
    ('Prospect En Attente', NULL, 'Conference', 'Exemple', 'Ari',
     'attente@example.com', 'Lieu fictif E', DATE '2027-04-15', 25,
     'Demande a examiner', 'a_contacter', NULL),
    ('Prospect Sans Suite', NULL, 'Gala', 'Exemple', 'Sam',
     'sans-suite@example.com', 'Lieu fictif F', DATE '2027-04-20', 45,
     'Demande refusee ou sans suite', 'echoue', NOW() - INTERVAL '15 days')
)
INSERT INTO innov_events.prospects
    (id_client, id_type_evenement, entreprise, nom, prenom, email, telephone,
     lieu_souhaite, date_souhaitee, nb_participants, description_besoin,
     statut_prospect, date_dernier_contact)
SELECT c.id_client, te.id_type_evenement, d.entreprise, d.nom, d.prenom, d.email,
       '00 00 00 00 00', d.lieu, d.date_souhaitee, d.participants, d.besoin,
       d.statut, d.dernier_contact
FROM donnees d
JOIN innov_events.types_evenement te ON te.libelle = d.type_evenement
LEFT JOIN innov_events.clients c ON c.entreprise = d.client;

-- Evitement des identifiants en dur : liens cherches dans les tables existantes.
-- Un evenement accepte peut l'etre sans devis accepte (validation admin).
-- Un evenement annule peut etre public si accord du client + case visible.
WITH donnees(client, prospect, type_evenement, theme, nom, debut, fin, lieu,
             statut, image_url, accord_publication, visible_public) AS (
    VALUES
    ('Atelier Demonstration', 'Atelier Demonstration', 'Gala', 'Professionnel',
     'Gala Demo Accepte', TIMESTAMPTZ '2027-03-10 18:00+01',
     TIMESTAMPTZ '2027-03-10 23:00+01', 'Lieu fictif A', 'accepte',
     'https://example.org/gala-demo.jpg', NOW() - INTERVAL '5 days', TRUE),
    ('Agence Suspendue', 'Agence Suspendue', 'Seminaire', 'Professionnel',
     'Seminaire En Cours', TIMESTAMPTZ '2026-11-12 09:00+01',
     TIMESTAMPTZ '2026-11-16 18:00+01', 'Lieu fictif B', 'en_cours',
     NULL, NULL, FALSE),
    ('Structure Effacable', 'Structure Effacable', 'Ceremonie', 'Culturel',
     'Ceremonie Historique Terminee', TIMESTAMPTZ '2026-10-10 14:00+02',
     TIMESTAMPTZ '2026-10-10 20:00+02', 'Lieu fictif C', 'termine',
     NULL, NOW() - INTERVAL '30 days', TRUE),
    ('Atelier Demonstration', NULL, 'Salon', NULL,
     'Salon Brouillon', TIMESTAMPTZ '2027-05-01 09:00+02',
     TIMESTAMPTZ '2027-05-01 17:00+02', 'Lieu fictif G', 'brouillon',
     NULL, NULL, FALSE),
    ('Collectif Demonstration', 'Collectif Demonstration', 'Salon', 'Solidaire',
     'Salon Annule', TIMESTAMPTZ '2027-01-20 10:00+01',
     TIMESTAMPTZ '2027-01-20 19:00+01', 'Lieu fictif D', 'annule',
     NULL, NOW() - INTERVAL '2 days', TRUE),
    ('Atelier Demonstration', NULL, 'Conference', 'Professionnel',
     'Conference Terminee', TIMESTAMPTZ '2026-09-15 09:00+02',
     TIMESTAMPTZ '2026-09-15 18:00+02', 'Lieu fictif H', 'termine',
     NULL, NOW() - INTERVAL '50 days', TRUE),
    ('Agence Suspendue', NULL, 'Gala', 'Culturel',
     'Remise de Prix Terminee', TIMESTAMPTZ '2026-10-01 18:00+02',
     TIMESTAMPTZ '2026-10-01 21:00+02', 'Lieu fictif I', 'termine',
     NULL, NULL, FALSE),
    ('Atelier Demonstration', NULL, 'Conference', NULL,
     'Conference Acceptee Manuellement', TIMESTAMPTZ '2027-06-01 10:00+02',
     TIMESTAMPTZ '2027-06-01 18:00+02', 'Lieu fictif J', 'accepte',
     NULL, NULL, FALSE)
)
INSERT INTO innov_events.evenements
    (id_client, id_prospect, id_type_evenement, id_theme, nom, date_debut,
     date_fin, lieu, statut_evenement, image_url, date_accord_publication, visible_public)
SELECT c.id_client, p.id_prospect, te.id_type_evenement, th.id_theme, d.nom,
       d.debut, d.fin, d.lieu, d.statut, d.image_url,
       d.accord_publication, d.visible_public
FROM donnees d
JOIN innov_events.clients c ON c.entreprise = d.client
JOIN innov_events.types_evenement te ON te.libelle = d.type_evenement
LEFT JOIN innov_events.themes th ON th.libelle = d.theme
LEFT JOIN innov_events.prospects p ON p.entreprise = d.prospect;

-- Formules alternatives : un seul devis accepte pour le Gala, deux refuses.
-- Les autres lignes couvrent etude_client, modification et en_preparation.
WITH donnees(evenement, intitule, statut, tva, envoi, motif, modification) AS (
    VALUES
    ('Gala Demo Accepte', 'Gala - Essentielle', 'accepte', 20.00,
     NOW() - INTERVAL '7 days', NULL, NULL),
    ('Gala Demo Accepte', 'Gala - Premium', 'refuse', 20.00,
     NOW() - INTERVAL '7 days', NULL, NULL),
    ('Gala Demo Accepte', 'Gala - Economique', 'refuse', 20.00,
     NOW() - INTERVAL '7 days', NULL, NULL),
    ('Seminaire En Cours', 'Seminaire - Standard', 'etude_client', 20.00,
     NOW() - INTERVAL '2 days', NULL, NULL),
    ('Salon Brouillon', 'Salon - Brouillon interne', 'en_preparation', 20.00,
     NULL, NULL, NULL),
    ('Conference Acceptee Manuellement', 'Conference - A modifier', 'modification', 20.00,
     NOW() - INTERVAL '4 days', 'Modifier la prestation restauration', NOW() - INTERVAL '1 day'),
    ('Ceremonie Historique Terminee', 'Ceremonie - Archive', 'accepte', 20.00,
     NOW() - INTERVAL '45 days', NULL, NULL)
)
INSERT INTO innov_events.devis
    (id_evenement, intitule, statut_devis, taux_tva_applique, date_envoi,
     motif_modification, date_modification)
SELECT e.id_evenement, d.intitule, d.statut, d.tva, d.envoi, d.motif, d.modification
FROM donnees d
JOIN innov_events.evenements e ON e.nom = d.evenement;

-- Chaque devis envoye a au moins une ligne ; le brouillon peut n'en avoir aucune.
-- Les totaux HT/TVA/TTC sont calcules a partir des lignes, jamais stockes.
WITH donnees(intitule, prestation, montant, ordre) AS (
    VALUES
    ('Gala - Essentielle', 'Salle et logistique', 1800.00, 1),
    ('Gala - Essentielle', 'Restauration', 2500.00, 2),
    ('Gala - Premium', 'Salle et animation', 3600.00, 1),
    ('Gala - Premium', 'Restauration', 4200.00, 2),
    ('Gala - Economique', 'Salle simple', 1000.00, 1),
    ('Seminaire - Standard', 'Location de salle', 750.00, 1),
    ('Seminaire - Standard', 'Equipements audiovisuels', 150.00, 2),
    ('Conference - A modifier', 'Organisation', 1200.00, 1),
    ('Conference - A modifier', 'Restauration', 600.00, 2),
    ('Ceremonie - Archive', 'Organisation historique', 900.00, 1)
)
INSERT INTO innov_events.lignes_devis
    (id_devis, libelle_prestation, montant_ht, ordre_affichage)
SELECT d.id_devis, x.prestation, x.montant, x.ordre
FROM donnees x
JOIN innov_events.devis d ON d.intitule = x.intitule;

-- Taches : a_faire, en_cours, termine. Seul l'affecte doit changer le statut (API).
WITH donnees(utilisateur, evenement, titre, description, statut) AS (
    VALUES
    ('jose_demo', 'Gala Demo Accepte', 'Verifier la salle', 'Test de preparation', 'a_faire'),
    ('jose_demo', 'Seminaire En Cours', 'Installer le materiel', 'Test de suivi', 'en_cours'),
    ('ancien_employe', 'Gala Demo Accepte', 'Confirmer les prestataires', 'A reaffecter', 'en_cours'),
    ('ancien_employe', 'Conference Terminee', 'Archiver le dossier', 'Tache conservee', 'termine'),
    ('chloe_demo', 'Salon Brouillon', 'Valider le programme', 'Test de planification', 'a_faire')
)
INSERT INTO innov_events.taches
    (id_utilisateur, id_evenement, titre, description, statut_tache)
SELECT u.id_utilisateur, e.id_evenement, d.titre, d.description, d.statut
FROM donnees d
JOIN innov_events.utilisateurs u ON u.nom_utilisateur = d.utilisateur
JOIN innov_events.evenements e ON e.nom = d.evenement;

-- Une note globale (sans evenement) est reservee a l'admin.
-- La note de l'evenement anonymise sera supprimee avec le compte client.
WITH donnees(utilisateur, evenement, contenu) AS (
    VALUES
    ('chloe_demo', NULL, 'Note globale de coordination'),
    ('jose_demo', 'Gala Demo Accepte', 'Verifier le plan de salle'),
    ('ancien_employe', 'Conference Terminee', 'Suivi historique a conserver'),
    ('jose_demo', 'Ceremonie Historique Terminee', 'Note a effacer avec le client')
)
INSERT INTO innov_events.notes (id_utilisateur, id_evenement, contenu)
SELECT u.id_utilisateur, e.id_evenement, d.contenu
FROM donnees d
JOIN innov_events.utilisateurs u ON u.nom_utilisateur = d.utilisateur
LEFT JOIN innov_events.evenements e ON e.nom = d.evenement;

-- Un seul avis par evenement, uniquement sur un evenement termine.
WITH donnees(evenement, commentaire, note, statut) AS (
    VALUES
    ('Ceremonie Historique Terminee', 'Prestation satisfaisante.', 5, 'valide'),
    ('Conference Terminee', 'Bonne organisation.', 4, 'en_attente'),
    ('Remise de Prix Terminee', 'Prestation a ameliorer.', 2, 'refuse')
)
INSERT INTO innov_events.avis
    (id_evenement, commentaire, note_evaluation, statut_avis)
SELECT e.id_evenement, d.commentaire, d.note, d.statut
FROM donnees d
JOIN innov_events.evenements e ON e.nom = d.evenement;

-- Session synthetique DEJA EXPIREE : aucun cookie utilisable par un visiteur.
-- sid est genere, jamais ecrit en dur, et ne provient pas d'une vraie session.
INSERT INTO innov_events.sessions (sid, sess, expire)
VALUES (md5(random()::text || clock_timestamp()::text), '{}'::json,
        (NOW() - INTERVAL '1 day')::timestamp);

-- Les taches non terminees de l'employe partant sont reaffectees a l'admin.
UPDATE innov_events.taches
   SET id_utilisateur = (SELECT id_utilisateur FROM innov_events.utilisateurs
                          WHERE nom_utilisateur = 'chloe_demo')
 WHERE id_utilisateur = (SELECT id_utilisateur FROM innov_events.utilisateurs
                          WHERE nom_utilisateur = 'ancien_employe')
   AND statut_tache <> 'termine';
SELECT innov_events.supprimer_compte_employe(
    (SELECT id_utilisateur FROM innov_events.utilisateurs
      WHERE nom_utilisateur = 'ancien_employe')
);

-- Suppression du compte client : supprime le compte, les prospects convertis et les notes liees,
-- anonymise la fiche, conserve evenements, devis et avis.
SELECT innov_events.supprimer_compte_client(
    (SELECT id_client FROM innov_events.clients
      WHERE entreprise = 'Structure Effacable')
);

-- Auto-controles bloquants : rollback automatique en cas de violation.
DO $$
DECLARE
    table_test TEXT;
    pleine BOOLEAN;
BEGIN
    FOREACH table_test IN ARRAY ARRAY[
        'utilisateurs', 'clients', 'types_evenement', 'themes', 'prospects',
        'evenements', 'devis', 'lignes_devis', 'taches', 'notes', 'avis',
        'parametres', 'sessions'
    ] LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM innov_events.%I)', table_test)
            INTO pleine;
        IF NOT pleine THEN
            RAISE EXCEPTION 'CO-05 : table vide : %', table_test;
        END IF;
    END LOOP;

    -- Controle du prefixe Argon2id ; les parametres sont definis par l API.
    IF EXISTS (
        SELECT 1 FROM innov_events.utilisateurs
        WHERE statut_compte <> 'supprime'
          AND COALESCE(mot_de_passe_hache, mdp_temporaire_hache)
              NOT LIKE '$argon2id$v=19$m=%'
    ) THEN
        RAISE EXCEPTION 'CO-05 : hachage Argon2id non conforme';
    END IF;

    IF (SELECT COUNT(DISTINCT role) FROM innov_events.utilisateurs) <> 3
       OR (SELECT COUNT(DISTINCT statut_compte) FROM innov_events.utilisateurs) <> 3
       OR (SELECT COUNT(DISTINCT statut_prospect) FROM innov_events.prospects) <> 3
       OR (SELECT COUNT(DISTINCT statut_evenement) FROM innov_events.evenements) <> 5
       OR (SELECT COUNT(DISTINCT statut_devis) FROM innov_events.devis) <> 5
       OR (SELECT COUNT(DISTINCT statut_tache) FROM innov_events.taches) <> 3
       OR (SELECT COUNT(DISTINCT statut_avis) FROM innov_events.avis) <> 3 THEN
        RAISE EXCEPTION 'CO-05 : un role ou un statut manque';
    END IF;

    IF (SELECT COUNT(*) FROM innov_events.devis d
        JOIN innov_events.evenements e ON e.id_evenement = d.id_evenement
        WHERE e.nom = 'Gala Demo Accepte' AND d.statut_devis = 'accepte') <> 1
       OR (SELECT COUNT(*) FROM innov_events.devis d
        JOIN innov_events.evenements e ON e.id_evenement = d.id_evenement
        WHERE e.nom = 'Gala Demo Accepte' AND d.statut_devis = 'refuse') <> 2 THEN
        RAISE EXCEPTION 'CO-05 : alternatives de devis incompletes';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM innov_events.clients
        WHERE date_anonymisation IS NOT NULL AND id_utilisateur IS NULL
          AND entreprise IS NULL AND nom_contact IS NULL
          AND prenom_contact IS NULL AND email_contact IS NULL
          AND telephone IS NULL AND adresse_postale IS NULL
    ) OR EXISTS (
        SELECT 1 FROM innov_events.utilisateurs WHERE nom_utilisateur = 'client_effacer'
    ) OR EXISTS (
        SELECT 1 FROM innov_events.notes n JOIN innov_events.evenements e
          ON e.id_evenement = n.id_evenement
        WHERE e.nom = 'Ceremonie Historique Terminee'
    ) THEN
        RAISE EXCEPTION 'CO-05 : anonymisation client incomplete';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM innov_events.utilisateurs u
        JOIN innov_events.notes n ON n.id_utilisateur = u.id_utilisateur
        WHERE u.statut_compte = 'supprime' AND u.role = 'employe'
          AND u.mot_de_passe_hache IS NULL AND u.mdp_temporaire_hache IS NULL
    ) OR NOT EXISTS (
        SELECT 1 FROM innov_events.utilisateurs u
        JOIN innov_events.taches t ON t.id_utilisateur = u.id_utilisateur
        WHERE u.statut_compte = 'supprime' AND t.statut_tache = 'termine'
    ) OR EXISTS (
        SELECT 1 FROM innov_events.utilisateurs u
        JOIN innov_events.taches t ON t.id_utilisateur = u.id_utilisateur
        WHERE u.statut_compte = 'supprime' AND t.statut_tache <> 'termine'
    ) THEN
        RAISE EXCEPTION 'CO-05 : suppression employe incomplete';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM innov_events.notes n
        JOIN innov_events.utilisateurs u ON u.id_utilisateur = n.id_utilisateur
        WHERE n.id_evenement IS NULL AND u.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'CO-05 : note globale absente';
    END IF;
END;
$$;

COMMIT;
