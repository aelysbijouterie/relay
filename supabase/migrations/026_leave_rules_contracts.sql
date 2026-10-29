-- ════════════════════════════════════════════════════════════════
-- RELAYS — Règles de congés des boutiques
-- • leave_blocked_periods : périodes saisies par la RH (changement de merch…)
--   où les congés sont refusés d'office (kind = 'block') ou déconseillés ('warning').
-- • profiles.contract_type : CDI / CDD / apprentissage… (règle « apprenti·e à l'école »).
-- • profiles.leave_balance_since : date à partir de laquelle les congés validés
--   dans RELAYS sont déduits du solde importé (le solde de départ est un « reste à poser »).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leave_blocked_periods (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'block' CHECK (kind IN ('block', 'warning')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_blocked_periods_dates ON leave_blocked_periods(start_date, end_date);
ALTER TABLE leave_blocked_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contract_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_balance_since DATE;

SELECT 'Règles de congés prêtes' AS info;
