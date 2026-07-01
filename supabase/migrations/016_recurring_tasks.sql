-- ════════════════════════════════════════════════════════════════
-- RELAYS — Cartes récurrentes
-- Un « modèle » décrit une carte à recréer automatiquement selon une
-- règle de récurrence. Un cron quotidien crée les cartes dues.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recurring_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'Moyenne',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Règle de récurrence :
  -- 'weekly'         → weekday (0=lundi … 6=dimanche)
  -- 'monthly_day'    → month_day (1..31)
  -- 'monthly_first'  → premier jour ouvré du mois
  -- 'monthly_last'   → dernier jour ouvré du mois
  -- 'daily'          → chaque jour ouvré
  frequency     TEXT NOT NULL CHECK (frequency IN ('weekly','monthly_day','monthly_first','monthly_last','daily')),
  weekday       INTEGER,   -- pour 'weekly'
  month_day     INTEGER,   -- pour 'monthly_day'

  assignee_ids  UUID[] DEFAULT '{}',   -- personnes à assigner aux cartes créées
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_run_date DATE,                  -- dernière date de génération (évite les doublons)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_tasks(is_active);

-- Lien optionnel : savoir qu'une carte a été générée par un modèle.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_task_id UUID REFERENCES recurring_tasks(id) ON DELETE SET NULL;

SELECT 'Cartes récurrentes prêtes (table recurring_tasks)' AS info;
