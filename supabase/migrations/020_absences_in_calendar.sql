-- ════════════════════════════════════════════════════════════════
-- RELAYS — Option : afficher les congés/absences validés dans le
-- calendrier des tâches (pour anticiper le planning).
-- Désactivé par défaut ; chacun l'active dans son profil.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_absences_calendar BOOLEAN DEFAULT false;

SELECT 'Préférence congés dans calendrier prête' AS info;
