-- ════════════════════════════════════════════════════════════════
-- RELAYS — Sous-sous-tâches + invités sur les événements de calendrier
-- ════════════════════════════════════════════════════════════════

-- Une sous-tâche peut avoir des sous-sous-tâches (1 niveau de plus, géré côté API).
ALTER TABLE task_subtasks
  ADD COLUMN IF NOT EXISTS parent_subtask_id UUID REFERENCES task_subtasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_task_subtasks_parent
  ON task_subtasks(parent_subtask_id) WHERE parent_subtask_id IS NOT NULL;

-- Invités d'un événement : personnes choisies une à une (pas forcément tout le service).
CREATE TABLE IF NOT EXISTS calendar_event_attendees (
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_calendar_event_attendees_user ON calendar_event_attendees(user_id);
ALTER TABLE calendar_event_attendees ENABLE ROW LEVEL SECURITY;

SELECT 'Sous-sous-tâches et invités d''événements prêts' AS info;
