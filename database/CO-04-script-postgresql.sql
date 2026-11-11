-- CO-04 — SCRIPT DE CREATION (PostgreSQL, verifie en version 16)
-- Conforme au MLD CO-04 (2 pages). Toute colonne est NOT NULL sauf mention contraire.
-- Prerequis : execution par un compte proprietaire de la base avec droit CREATEROLE.
-- Le role applicatif est cree SANS mot de passe : le secret sera configure separement.
-- Jeu de donnees : hors perimetre (CO-05). Les cles sont GENERATED ALWAYS : le jeu
-- d'essai n'impose pas d'identifiants (sinon OVERRIDING SYSTEM VALUE + recalage).

BEGIN;

CREATE SCHEMA IF NOT EXISTS innov_events;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'innov_events_app') THEN
        CREATE ROLE innov_events_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END
$$;

-- 1. Utilisateurs (identite de connexion et roles).
-- Le mot de passe temporaire ne remplace pas le mot de passe actuel : une demande
-- "mot de passe oublie" faite par un tiers ne bloque donc pas le titulaire.
-- Il sert une fois, puis l'API l'efface ; se connecter avec lui impose le changement.
-- Suppression d'un compte : physique pour un client (RGPD), logique pour un employe
-- (statut 'supprime', identite anonymisee, notes et taches conservees).
CREATE TABLE innov_events.utilisateurs (
    id_utilisateur BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email_connexion VARCHAR(255) NOT NULL,
    nom_utilisateur VARCHAR(100) NOT NULL UNIQUE,
    prenom VARCHAR(120) NOT NULL,
    nom VARCHAR(120) NOT NULL,
    mot_de_passe_hache TEXT,                 -- NULL : compte cree automatiquement sans mot de passe choisi, ou compte supprime
    mdp_temporaire_hache TEXT,
    mdp_temporaire_expire_le TIMESTAMPTZ,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employe', 'client')),
    statut_compte VARCHAR(20) NOT NULL DEFAULT 'actif'
        CHECK (statut_compte IN ('actif', 'suspendu', 'supprime')),
    CONSTRAINT ck_mdp_temporaire_paire CHECK (
        (mdp_temporaire_hache IS NULL) = (mdp_temporaire_expire_le IS NULL)
    ),
    -- Un compte actif ou suspendu a au moins un mot de passe ; un compte supprime n'en a plus.
    CONSTRAINT ck_mdp_selon_statut CHECK (
        (statut_compte <> 'supprime'
            AND (mot_de_passe_hache IS NOT NULL OR mdp_temporaire_hache IS NOT NULL))
        OR
        (statut_compte = 'supprime'
            AND mot_de_passe_hache IS NULL AND mdp_temporaire_hache IS NULL)
    ),
    -- Seul un compte employe passe en suppression logique (un compte client est efface).
    CONSTRAINT ck_supprime_employe CHECK (
        statut_compte <> 'supprime' OR role = 'employe'
    )
);

-- Un email de connexion est unique meme si la casse differe.
CREATE UNIQUE INDEX uq_utilisateurs_email_ci
    ON innov_events.utilisateurs (LOWER(email_connexion));

-- 2. Clients (coordonnees commerciales, distinctes de l'identite de connexion).
-- Anonymisation RGPD : coordonnees mises a NULL et date_anonymisation renseignee.
CREATE TABLE innov_events.clients (
    id_client BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_utilisateur BIGINT UNIQUE REFERENCES innov_events.utilisateurs(id_utilisateur)
        ON DELETE SET NULL,
    entreprise VARCHAR(255),
    nom_contact VARCHAR(120),
    prenom_contact VARCHAR(120),
    email_contact VARCHAR(255),
    telephone VARCHAR(35),
    adresse_postale TEXT,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_anonymisation TIMESTAMPTZ,
    CONSTRAINT ck_client_coordonnees CHECK (
        (date_anonymisation IS NULL
            AND entreprise IS NOT NULL AND nom_contact IS NOT NULL
            AND prenom_contact IS NOT NULL AND email_contact IS NOT NULL
            AND telephone IS NOT NULL)
        OR
        (date_anonymisation IS NOT NULL
            AND id_utilisateur IS NULL
            AND entreprise IS NULL AND nom_contact IS NULL
            AND prenom_contact IS NULL AND email_contact IS NULL
            AND telephone IS NULL AND adresse_postale IS NULL)
    )
);

-- 3. Referentiels des filtres de la page Evenements (remplis par script).
CREATE TABLE innov_events.types_evenement (
    id_type_evenement SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);
CREATE UNIQUE INDEX uq_types_evenement_libelle_ci
    ON innov_events.types_evenement (LOWER(libelle));

CREATE TABLE innov_events.themes (
    id_theme SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);
CREATE UNIQUE INDEX uq_themes_libelle_ci
    ON innov_events.themes (LOWER(libelle));

-- 4. Prospects (demandes de devis ; tous les champs du formulaire sont obligatoires).
CREATE TABLE innov_events.prospects (
    id_prospect BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_client BIGINT REFERENCES innov_events.clients(id_client) ON DELETE CASCADE,
    id_type_evenement SMALLINT NOT NULL
        REFERENCES innov_events.types_evenement(id_type_evenement) ON DELETE RESTRICT,
    entreprise VARCHAR(255) NOT NULL,
    nom VARCHAR(120) NOT NULL,
    prenom VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telephone VARCHAR(35) NOT NULL,
    lieu_souhaite TEXT NOT NULL,
    date_souhaitee DATE NOT NULL,
    nb_participants INTEGER NOT NULL CHECK (nb_participants > 0),
    description_besoin TEXT NOT NULL,
    statut_prospect VARCHAR(20) NOT NULL DEFAULT 'a_contacter'
        CHECK (statut_prospect IN ('a_contacter', 'echoue', 'converti')),
    date_demande TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_dernier_contact TIMESTAMPTZ,        -- NULL tant que personne n'a recontacte le prospect
    CONSTRAINT ck_prospect_converti_rattache CHECK (
        (statut_prospect = 'converti') = (id_client IS NOT NULL)
    ),
    -- La purge des prospects 'echoue' (3 ans apres le dernier contact) suppose cette date.
    CONSTRAINT ck_prospect_echoue_date CHECK (
        statut_prospect <> 'echoue' OR date_dernier_contact IS NOT NULL
    )
);

-- 5. Evenements (chaque evenement appartient a un client).
-- Publication sur la page Evenements : filtre de requete, pas de CHECK
--   visible_public AND date_accord_publication IS NOT NULL AND statut_evenement <> 'brouillon'
-- Ainsi le client peut retirer son accord sans effacer le choix de l'administrateur.
CREATE TABLE innov_events.evenements (
    id_evenement BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_client BIGINT NOT NULL REFERENCES innov_events.clients(id_client)
        ON DELETE RESTRICT,
    id_prospect BIGINT UNIQUE REFERENCES innov_events.prospects(id_prospect)
        ON DELETE SET NULL,
    id_type_evenement SMALLINT NOT NULL
        REFERENCES innov_events.types_evenement(id_type_evenement) ON DELETE RESTRICT,
    id_theme SMALLINT REFERENCES innov_events.themes(id_theme) ON DELETE RESTRICT,
    nom VARCHAR(255) NOT NULL,
    date_debut TIMESTAMPTZ NOT NULL,
    date_fin TIMESTAMPTZ NOT NULL,
    lieu TEXT NOT NULL,
    statut_evenement VARCHAR(20) NOT NULL DEFAULT 'brouillon'
        CHECK (statut_evenement IN ('brouillon', 'accepte', 'en_cours', 'termine', 'annule')),
    image_url TEXT,
    date_accord_publication TIMESTAMPTZ,
    visible_public BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_evenement_dates CHECK (date_fin > date_debut)
);

-- 6. Devis (plusieurs formules possibles par evenement, un seul devis accepte).
-- Une demande de modification met a jour le devis concerne : seuls le dernier motif
-- et sa date sont conserves. A l'acceptation, l'API passe les autres devis ouverts
-- de l'evenement a 'refuse' dans la meme transaction.
CREATE TABLE innov_events.devis (
    id_devis BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_evenement BIGINT NOT NULL REFERENCES innov_events.evenements(id_evenement)
        ON DELETE RESTRICT,
    intitule VARCHAR(255) NOT NULL,
    statut_devis VARCHAR(25) NOT NULL DEFAULT 'en_preparation'
        CHECK (statut_devis IN ('en_preparation', 'etude_client', 'accepte', 'refuse', 'modification')),
    taux_tva_applique NUMERIC(5,2) NOT NULL
        CHECK (taux_tva_applique BETWEEN 0 AND 100),
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_envoi TIMESTAMPTZ,
    motif_modification TEXT,
    date_modification TIMESTAMPTZ,
    CONSTRAINT ck_devis_envoi CHECK (
        statut_devis = 'en_preparation' OR date_envoi IS NOT NULL
    ),
    CONSTRAINT ck_devis_motif CHECK (
        statut_devis <> 'modification' OR motif_modification IS NOT NULL
    ),
    CONSTRAINT ck_devis_motif_date CHECK (
        (motif_modification IS NULL) = (date_modification IS NULL)
    )
);

-- Un seul devis accepte par evenement.
CREATE UNIQUE INDEX uq_devis_accepte_par_evenement
    ON innov_events.devis (id_evenement)
    WHERE statut_devis = 'accepte';

-- 7. Lignes de devis (montants HT des prestations ; HT/TVA/TTC calcules, non stockes).
-- Contrainte d'ordre differee : on peut permuter deux lignes dans une transaction.
CREATE TABLE innov_events.lignes_devis (
    id_ligne_devis BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_devis BIGINT NOT NULL REFERENCES innov_events.devis(id_devis) ON DELETE CASCADE,
    libelle_prestation TEXT NOT NULL,
    montant_ht NUMERIC(12,2) NOT NULL CHECK (montant_ht >= 0),
    ordre_affichage INTEGER NOT NULL CHECK (ordre_affichage > 0),
    CONSTRAINT uq_lignes_ordre_par_devis UNIQUE (id_devis, ordre_affichage)
        DEFERRABLE INITIALLY DEFERRED
);

-- 8. Taches (affectees par l'administrateur a un employe ou a lui-meme).
-- Suppression logique d'un employe : ses taches restent rattachees ; l'admin
-- reaffecte celles qui sont en cours. La suppression physique est bloquee.
CREATE TABLE innov_events.taches (
    id_tache BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_utilisateur BIGINT NOT NULL REFERENCES innov_events.utilisateurs(id_utilisateur)
        ON DELETE RESTRICT,
    id_evenement BIGINT NOT NULL REFERENCES innov_events.evenements(id_evenement)
        ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    statut_tache VARCHAR(20) NOT NULL DEFAULT 'a_faire'
        CHECK (statut_tache IN ('a_faire', 'en_cours', 'termine')),
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_echeance TIMESTAMPTZ
);

-- 9. Notes (id_evenement NULL = note globale ; l'auteur reste rattache, meme apres
-- suppression logique de son compte).
CREATE TABLE innov_events.notes (
    id_note BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_utilisateur BIGINT NOT NULL REFERENCES innov_events.utilisateurs(id_utilisateur)
        ON DELETE RESTRICT,
    id_evenement BIGINT REFERENCES innov_events.evenements(id_evenement)
        ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_modification TIMESTAMPTZ
);

-- 10. Avis (au maximum un avis par evenement, donc par client).
CREATE TABLE innov_events.avis (
    id_avis BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_evenement BIGINT NOT NULL UNIQUE REFERENCES innov_events.evenements(id_evenement)
        ON DELETE CASCADE,
    commentaire TEXT NOT NULL,
    note_evaluation SMALLINT NOT NULL CHECK (note_evaluation BETWEEN 1 AND 5),
    statut_avis VARCHAR(20) NOT NULL DEFAULT 'en_attente'
        CHECK (statut_avis IN ('en_attente', 'valide', 'refuse')),
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Parametres (un seul enregistrement possible : id = 1).
CREATE TABLE innov_events.parametres (
    id_parametres SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id_parametres = 1),
    texte_remerciement TEXT NOT NULL,
    taux_tva_defaut NUMERIC(5,2) NOT NULL CHECK (taux_tva_defaut BETWEEN 0 AND 100)
);

-- 12. Sessions (structure attendue par connect-pg-simple, licence MIT).
-- Configuration : tableName 'sessions', schemaName 'innov_events', createTableIfMissing false.
CREATE TABLE innov_events.sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- 13. Suppression de comptes (regles CO-03), en une seule operation atomique.
-- Client (RGPD) : notes de ses evenements et demandes de devis supprimees, compte
-- efface, fiche anonymisee ; devis, evenements et avis conserves sans nom.
CREATE FUNCTION innov_events.supprimer_compte_client(p_id_client BIGINT)
RETURNS void LANGUAGE sql AS $$
    DELETE FROM innov_events.notes
     WHERE id_evenement IN (SELECT id_evenement FROM innov_events.evenements
                             WHERE id_client = p_id_client);
    DELETE FROM innov_events.prospects WHERE id_client = p_id_client;
    DELETE FROM innov_events.utilisateurs
     WHERE id_utilisateur = (SELECT id_utilisateur FROM innov_events.clients
                              WHERE id_client = p_id_client);
    UPDATE innov_events.clients
       SET id_utilisateur = NULL, entreprise = NULL, nom_contact = NULL,
           prenom_contact = NULL, email_contact = NULL, telephone = NULL,
           adresse_postale = NULL, date_anonymisation = NOW()
     WHERE id_client = p_id_client;
$$;

-- Employe : suppression logique, identite remplacee par des valeurs uniques
-- (domaine reserve .invalid), mots de passe effaces ; notes et taches conservees.
-- Appelee sur un compte client ou admin, elle echoue sur ck_supprime_employe.
CREATE FUNCTION innov_events.supprimer_compte_employe(p_id_utilisateur BIGINT)
RETURNS void LANGUAGE sql AS $$
    UPDATE innov_events.utilisateurs
       SET statut_compte = 'supprime',
           email_connexion = 'supprime-' || id_utilisateur || '@compte.invalid',
           nom_utilisateur = 'supprime-' || id_utilisateur,
           prenom = 'Compte', nom = 'supprime',
           mot_de_passe_hache = NULL, mdp_temporaire_hache = NULL,
           mdp_temporaire_expire_le = NULL
     WHERE id_utilisateur = p_id_utilisateur;
$$;

-- Index : FK non couvertes par un PK/UNIQUE, tris et filtres frequents.
-- lignes_devis.id_devis est deja en tete d'un index UNIQUE.
CREATE INDEX idx_prospects_id_client ON innov_events.prospects(id_client);
CREATE INDEX idx_prospects_id_type_evenement ON innov_events.prospects(id_type_evenement);
CREATE INDEX idx_evenements_id_client ON innov_events.evenements(id_client);
CREATE INDEX idx_devis_id_evenement ON innov_events.devis(id_evenement);
CREATE INDEX idx_evenements_id_type_evenement ON innov_events.evenements(id_type_evenement);
CREATE INDEX idx_evenements_id_theme ON innov_events.evenements(id_theme);
CREATE INDEX idx_evenements_date_debut ON innov_events.evenements(date_debut);
CREATE INDEX idx_taches_id_utilisateur ON innov_events.taches(id_utilisateur);
CREATE INDEX idx_taches_id_evenement ON innov_events.taches(id_evenement);
CREATE INDEX idx_notes_id_utilisateur ON innov_events.notes(id_utilisateur);
CREATE INDEX idx_notes_id_evenement ON innov_events.notes(id_evenement);
CREATE INDEX idx_notes_date_creation ON innov_events.notes(date_creation);
CREATE INDEX idx_sessions_expire ON innov_events.sessions(expire);

-- Principe du moindre privilege : pas de CREATE, DROP, ALTER ni TRUNCATE.
-- Les colonnes IDENTITY n'exigent aucun droit sur leurs sequences.
GRANT USAGE ON SCHEMA innov_events TO innov_events_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    innov_events.utilisateurs, innov_events.clients, innov_events.prospects,
    innov_events.evenements, innov_events.devis, innov_events.lignes_devis,
    innov_events.taches, innov_events.notes, innov_events.avis,
    innov_events.sessions
    TO innov_events_app;
GRANT SELECT, UPDATE ON innov_events.parametres TO innov_events_app;
GRANT SELECT ON innov_events.types_evenement, innov_events.themes TO innov_events_app;
REVOKE EXECUTE ON FUNCTION innov_events.supprimer_compte_client(BIGINT),
    innov_events.supprimer_compte_employe(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION innov_events.supprimer_compte_client(BIGINT),
    innov_events.supprimer_compte_employe(BIGINT) TO innov_events_app;
ALTER ROLE innov_events_app SET search_path = innov_events;

COMMIT;

-- A FAIRE HORS SCRIPT : definir le mot de passe du role par secret d'environnement.
-- Controles applicatifs necessaires (regles entre plusieurs lignes ou tables) :
-- transitions des statuts ; compte admin cree uniquement par script ; taches et notes
-- reservees aux roles admin et employe ; note globale reservee a l'admin ; au moins
-- une ligne avant l'envoi d'un devis ; a l'acceptation, autres devis ouverts passes
-- a 'refuse' ; avis seulement sur un evenement 'termine' ; evenement et prospect
-- rattaches au meme client ; appel des fonctions de suppression de compte ;
-- purge des prospects 'echoue' 3 ans apres date_dernier_contact.
