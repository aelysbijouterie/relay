-- ============================================================
-- RELAYS — Schéma initial
-- ============================================================

-- Départements
CREATE TABLE departments (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  color TEXT NOT NULL,
  icon  TEXT,
  slug  TEXT UNIQUE NOT NULL
);

-- Profils utilisateurs (étend auth.users)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'collaborateur')),
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Tâches
CREATE TABLE tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'A Faire'
                     CHECK (status IN ('A Faire','En cours','Bloqué','A revoir','Terminé','Archivé')),
  priority           TEXT NOT NULL DEFAULT 'Moyenne'
                     CHECK (priority IN ('Urgent','Élevée','Moyenne','Faible')),
  department_id      UUID NOT NULL REFERENCES departments(id),
  created_by         UUID NOT NULL REFERENCES profiles(id),
  deadline           DATE,
  is_cross_team      BOOLEAN DEFAULT false,
  fournisseur_client TEXT,
  ref_collection     TEXT,
  parent_task_id     UUID REFERENCES tasks(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- Assignations (many-to-many)
CREATE TABLE task_assignees (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

-- Départements liés aux tâches inter-équipes
CREATE TABLE task_departments (
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, department_id)
);

-- Pièces jointes
CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Templates de tâches
CREATE TABLE task_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id       UUID REFERENCES departments(id),
  name                TEXT NOT NULL,
  default_title       TEXT,
  default_priority    TEXT DEFAULT 'Moyenne',
  default_description TEXT,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Filtres sauvegardés
CREATE TABLE saved_filters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  filters    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEX DE PERFORMANCE
-- ============================================================
CREATE INDEX idx_tasks_department    ON tasks(department_id);
CREATE INDEX idx_tasks_status        ON tasks(status);
CREATE INDEX idx_tasks_deadline      ON tasks(deadline);
CREATE INDEX idx_tasks_created_by    ON tasks(created_by);
CREATE INDEX idx_tasks_cross_team    ON tasks(is_cross_team) WHERE is_cross_team = true;
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_dept_dept      ON task_departments(department_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates   ENABLE ROW LEVEL SECURITY;

-- Departments — lisibles par tous les authentifiés
CREATE POLICY "departments_select" ON departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Profiles SELECT
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR id = auth.uid()
  );

-- Profiles UPDATE — chacun peut modifier le sien
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Tasks SELECT
-- Visible si : même département OU inter-équipes vers mon dept OU je suis assigné OU admin
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR id IN (
      SELECT task_id FROM task_departments
      WHERE department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR id IN (
      SELECT task_id FROM task_assignees WHERE user_id = auth.uid()
    )
  );

-- Tasks INSERT
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Tasks UPDATE
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    OR created_by = auth.uid()
    OR id IN (SELECT task_id FROM task_assignees WHERE user_id = auth.uid())
  );

-- Tasks DELETE
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
      AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
  );

-- task_assignees SELECT
CREATE POLICY "task_assignees_select" ON task_assignees FOR SELECT
  USING (
    task_id IN (SELECT id FROM tasks)
  );

CREATE POLICY "task_assignees_insert" ON task_assignees FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM tasks WHERE
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "task_assignees_delete" ON task_assignees FOR DELETE
  USING (
    task_id IN (SELECT id FROM tasks WHERE
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
      OR created_by = auth.uid()
    )
  );

-- task_departments SELECT
CREATE POLICY "task_departments_select" ON task_departments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks));

CREATE POLICY "task_departments_insert" ON task_departments FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM tasks WHERE
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "task_departments_delete" ON task_departments FOR DELETE
  USING (
    task_id IN (SELECT id FROM tasks WHERE
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
      OR created_by = auth.uid()
    )
  );

-- attachments
CREATE POLICY "attachments_select" ON attachments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks));

CREATE POLICY "attachments_insert" ON attachments FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks) AND uploaded_by = auth.uid());

-- saved_filters — uniquement les siens
CREATE POLICY "saved_filters_select" ON saved_filters FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "saved_filters_insert" ON saved_filters FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_filters_delete" ON saved_filters FOR DELETE
  USING (user_id = auth.uid());

-- task_templates
CREATE POLICY "task_templates_select" ON task_templates FOR SELECT
  USING (
    department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
