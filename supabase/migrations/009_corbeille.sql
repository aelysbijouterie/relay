-- ════════════════════════════════════════════════════════════════
-- RELAYS — Corbeille (suppression récupérable)
-- Au lieu d'effacer définitivement, on marque la date de suppression.
-- Les tâches avec deleted_at non nul sont masquées partout, mais
-- récupérables depuis la corbeille (ou supprimables définitivement).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

SELECT 'Corbeille prête (colonne deleted_at ajoutée)' AS info;
