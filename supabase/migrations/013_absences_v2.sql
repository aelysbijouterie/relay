-- ════════════════════════════════════════════════════════════════
-- RELAYS — Congés v2 : Alternance, périodes d'activité, modifications
-- ════════════════════════════════════════════════════════════════

-- 1. Ajouter le motif "Alternance" (auto-validé côté application).
ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_type_check;
ALTER TABLE absences ADD CONSTRAINT absences_type_check
  CHECK (type IN ('Congés payés','RTT','Maladie','Télétravail','Alternance','Autre'));

-- 2. Statut "Modif. en attente" quand on modifie une absence déjà validée.
ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_status_check;
ALTER TABLE absences ADD CONSTRAINT absences_status_check
  CHECK (status IN ('En attente','Validé','Refusé','Modif. en attente'));

-- Sauvegarde des valeurs précédentes pendant une demande de modification,
-- pour pouvoir afficher l'ancienne version tant que ce n'est pas validé.
ALTER TABLE absences ADD COLUMN IF NOT EXISTS pending_start_date DATE;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS pending_end_date   DATE;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS pending_start_period TEXT;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS pending_end_period   TEXT;

-- 3. Périodes d'activité (dissuasives) définies par un responsable pour son service.
CREATE TABLE IF NOT EXISTS activity_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  label         TEXT,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_periods_dept  ON activity_periods(department_id);
CREATE INDEX IF NOT EXISTS idx_activity_periods_dates ON activity_periods(start_date, end_date);

SELECT 'Congés v2 prêt (Alternance + périodes activité + modifications)' AS info;
