-- RELAYS — Relances des demandes de congés des boutiques (48 h et 72 h)
-- rh_pending_since : début de l'attente pour une MODIFICATION (pour une demande neuve, created_at fait foi).
-- rh_reminder_48_at / rh_reminder_72_at : date d'envoi des relances (jamais envoyées deux fois).
ALTER TABLE absences ADD COLUMN IF NOT EXISTS rh_pending_since  TIMESTAMPTZ;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS rh_reminder_48_at TIMESTAMPTZ;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS rh_reminder_72_at TIMESTAMPTZ;

SELECT count(*) AS demandes_en_attente_boutiques
FROM absences a JOIN profiles p ON p.id = a.user_id
WHERE a.status IN ('En attente', 'Modif. en attente') AND p.boutique_id IS NOT NULL;
