-- RELAYS — Signalement d'absence par les boutiques : pièce jointe (arrêt maladie)
-- Le fichier est stocké dans le bucket privé « absence-docs » (créé automatiquement par l'application) ;
-- seules ces deux colonnes sont à ajouter.
ALTER TABLE absences ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS attachment_name TEXT;

SELECT count(*) AS absences_avec_piece_jointe FROM absences WHERE attachment_path IS NOT NULL;
