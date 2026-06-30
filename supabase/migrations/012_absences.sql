-- ════════════════════════════════════════════════════════════════
-- RELAYS — Module Congés / Absences
-- Calendrier partagé des absences, avec demandes et validation par
-- le responsable (manager/admin) du service du demandeur.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS absences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('Congés payés','RTT','Maladie','Télétravail','Autre')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  -- Demi-journées : 'full' = journée entière, 'am' = matin, 'pm' = après-midi.
  -- S'appliquent au premier et au dernier jour de la période.
  start_period  TEXT NOT NULL DEFAULT 'full' CHECK (start_period IN ('full','am','pm')),
  end_period    TEXT NOT NULL DEFAULT 'full' CHECK (end_period IN ('full','am','pm')),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'En attente' CHECK (status IN ('En attente','Validé','Refusé')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absences_user   ON absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates  ON absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON absences(status);

SELECT 'Module absences prêt (table absences créée)' AS info;
