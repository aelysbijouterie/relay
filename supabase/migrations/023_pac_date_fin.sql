-- Date de fin dédiée à l'opération (déjà exécutée en base).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_date_fin DATE;
