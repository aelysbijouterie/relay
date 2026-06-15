-- Commentaires sur les tâches
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select" ON task_comments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks));

CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT
  WITH CHECK (author_id = auth.uid() AND task_id IN (SELECT id FROM tasks));

CREATE POLICY "task_comments_update" ON task_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE
  USING (author_id = auth.uid());
