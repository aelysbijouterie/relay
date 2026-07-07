-- ════════════════════════════════════════════════════════════════
-- RELAYS — Services affichés par défaut dans le tableau des congés
-- Chacun choisit dans son profil quels services voir par défaut.
-- Tableau d'UUID de services ; NULL/vide = comportement par défaut
-- (le service actif de la personne).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS conges_default_dept_ids UUID[] DEFAULT NULL;

SELECT 'Préférence services congés prête' AS info;
