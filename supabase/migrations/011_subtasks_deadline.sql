-- ════════════════════════════════════════════════════════════════
-- RELAYS — Échéances sur les sous-tâches
-- Permet de donner une date limite propre à chaque sous-tâche,
-- indépendante de l'échéance de la carte parente.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE task_subtasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_task_subtasks_deadline ON task_subtasks(deadline);

SELECT 'Échéances de sous-tâches prêtes (colonne deadline ajoutée)' AS info;

-- Sécurité : s'assurer que la colonne position existe (pour le glisser-déposer).
ALTER TABLE task_subtasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
