-- ============================================================
-- RELAYS — Historique d'activité des cartes (suivi complet)
-- ============================================================
-- Trace toutes les actions sur une tâche : changements de champ
-- (statut, priorité, échéance, titre…), commentaires, sous-tâches.
-- Chaque ligne = un événement horodaté, attribué à son auteur.

CREATE TABLE IF NOT EXISTS task_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- type d'événement : 'status', 'field', 'comment', 'subtask',
  -- 'attachment', 'assignees', 'created', 'archived'
  type        TEXT NOT NULL,
  -- nom du champ concerné quand type = 'field' (ex : 'priority', 'deadline')
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task
  ON task_activity (task_id, created_at DESC);

-- On lit/écrit l'activité via le client admin (service role) côté serveur,
-- comme le reste de RELAYS. RLS activé par cohérence (defense in depth).
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;
