-- ════════════════════════════════════════════════════════════════
-- RELAYS — Événements de calendrier (réunions, anniversaires...)
-- Indépendants des cartes Kanban : jamais affichés dans le Kanban,
-- uniquement dans la vue Calendrier.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  event_date    DATE NOT NULL,           -- date d'ancrage (jour + mois utilisés si récurrent)
  event_time    TIME,                    -- heure optionnelle
  note          TEXT,
  category      TEXT NOT NULL DEFAULT 'autre' CHECK (category IN ('reunion', 'anniversaire', 'autre')),
  is_recurring_yearly BOOLEAN NOT NULL DEFAULT false,
  is_shared     BOOLEAN NOT NULL DEFAULT false,   -- false = personnel ; true = partagé avec le service
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL, -- service au moment de la création (si partagé)
  created_by    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_department ON calendar_events(department_id);

SELECT 'Événements de calendrier prêts' AS info;
