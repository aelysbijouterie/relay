-- PAC & Média Kit : catégorie + champs spécifiques (déjà exécutée en base).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_category TEXT
  CHECK (op_category IN ('operation_commerciale', 'media_kit'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_date_debut DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_mecanique    TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_cgv          TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_exclusions   TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_commentaires TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_montant      NUMERIC;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_references   TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_op_category ON tasks(op_category) WHERE op_category IS NOT NULL;
