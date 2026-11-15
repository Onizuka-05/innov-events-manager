-- Migration du 15/11/2026 (J8) : contrainte ck_devis_envoi de innov_events.devis.
-- Un brouillon jamais envoye peut desormais passer a 'refuse' sans date d'envoi :
-- c'est le cas quand le client accepte un autre devis du meme evenement (cycle CO-02).
-- Bases deja creees avec l'ancien CO-04 : base locale Docker et Neon (production).
-- A executer une fois, par le proprietaire du schema (pas par innov_events_app),
-- AVANT de deployer l'API du J8. Aucune ligne existante n'est modifiee.
BEGIN;
ALTER TABLE innov_events.devis DROP CONSTRAINT ck_devis_envoi;
ALTER TABLE innov_events.devis ADD CONSTRAINT ck_devis_envoi
    CHECK (statut_devis IN ('en_preparation', 'refuse') OR date_envoi IS NOT NULL);
COMMIT;
