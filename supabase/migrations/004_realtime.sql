-- ============================================================
-- REALTIME : activation de la réplication Postgres
-- ============================================================
-- ENABLE ROW LEVEL SECURITY + CREATE POLICY ne suffisent pas pour que
-- Supabase Realtime (postgres_changes) émette des événements : les tables
-- doivent en plus être ajoutées à la publication `supabase_realtime`.
-- Sans cette étape, aucun événement ne part jamais, même avec une
-- connexion authentifiée et des policies RLS correctes — silencieusement.
--
-- Écrit de façon idempotente : ne plante pas si une table a déjà été
-- ajoutée manuellement via le dashboard Supabase (Database > Replication).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_assignees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_assignees;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_departments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_departments;
  END IF;
END $$;
