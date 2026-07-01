-- ════════════════════════════════════════════════════════════════
-- RELAYS — Ordre manuel des cartes dans une colonne du Kanban
-- Permet de glisser les cartes pour les réordonner au sein d'un
-- même statut (et pas seulement de changer de colonne).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position NUMERIC DEFAULT NULL;

-- Initialise position selon l'ordre actuel (par date de création) au sein
-- de chaque statut, pour que l'ordre existant soit préservé.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at DESC) AS rn
  FROM tasks
)
UPDATE tasks t SET position = r.rn FROM ranked r WHERE t.id = r.id AND t.position IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(status, position);

SELECT 'Ordre manuel des cartes prêt (colonne position)' AS info;
