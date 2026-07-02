-- ════════════════════════════════════════════════════════════════
-- RELAYS — Préférences d'affichage du calendrier
-- Jours fériés et vacances scolaires (zone B), masquables par chacun.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_holidays BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_school_holidays BOOLEAN DEFAULT true;

SELECT 'Préférences calendrier prêtes' AS info;
