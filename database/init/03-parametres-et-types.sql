-- Donnees de reference minimales, rejouables sans ecraser les valeurs existantes.
-- Executer avec le proprietaire de la base, jamais avec le role applicatif.
BEGIN;
INSERT INTO innov_events.parametres (id_parametres, texte_remerciement, taux_tva_defaut)
VALUES (1, 'Merci, votre demande a bien été enregistrée. Notre équipe vous recontactera.', 20)
ON CONFLICT (id_parametres) DO NOTHING;

INSERT INTO innov_events.types_evenement (libelle)
VALUES ('Séminaire'), ('Conférence'), ('Team building'), ('Soirée d’entreprise'), ('Autre')
ON CONFLICT DO NOTHING;
COMMIT;
