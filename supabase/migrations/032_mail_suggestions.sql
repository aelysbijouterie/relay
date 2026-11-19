-- RELAYS — Mails à traiter : actions proposées à partir de la boîte mail  (À EXÉCUTER PAR MANON, une seule fois)
--
-- Chaque matin à 08h (Paris), RELAYS lit les mails reçus, une IA en tire les actions à mener, et elles apparaissent
-- dans « Mails à traiter » pour être transformées en cartes (ou créées d'office si MAIL_AUTO_CREATE=true).
-- Cette table sert aussi de mémoire : un mail n'est jamais analysé deux fois (statut « none » = aucune action).
-- Aucun accès depuis le navigateur : tout passe par le serveur (comme les autres tables).

CREATE TABLE IF NOT EXISTS mail_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   TEXT NOT NULL,
  action_idx   INT  NOT NULL DEFAULT 0,
  owner_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'dismissed', 'none')),
  from_name    TEXT,
  from_email   TEXT,
  subject      TEXT,
  received_at  TIMESTAMPTZ,
  title        TEXT,
  description  TEXT,
  priority     TEXT,
  deadline     DATE,
  task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, action_idx)
);

CREATE INDEX IF NOT EXISTS idx_mail_suggestions_pending ON mail_suggestions (owner_id, status, received_at DESC);

ALTER TABLE mail_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mail_suggestions FROM anon, authenticated;
