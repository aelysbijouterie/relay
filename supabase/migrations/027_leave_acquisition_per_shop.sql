-- ════════════════════════════════════════════════════════════════
-- RELAYS — Acquisition des congés, périodes interdites par magasin
-- • leave_blocked_periods.boutique_id : NULL = toutes les boutiques, sinon une seule.
-- • profiles.leave_acquiring : jours « en cours d'acquisition » (+2,08 / mois, passent en acquis au 1er juin).
-- • profiles.leave_taken_period : jours déjà pris sur la période en cours (hors RELAYS), pour le plafond de 5 semaines.
-- • leave_accrual_runs : garde-fou pour que le calcul mensuel ne s'exécute qu'une fois par mois.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE leave_blocked_periods
  ADD COLUMN IF NOT EXISTS boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_leave_blocked_periods_boutique ON leave_blocked_periods(boutique_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_acquiring NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_taken_period NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS leave_accrual_runs (
  period TEXT PRIMARY KEY,                       -- 'YYYY-MM'
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leave_accrual_runs ENABLE ROW LEVEL SECURITY;

SELECT 'Acquisition des congés et périodes par magasin prêtes' AS info;
