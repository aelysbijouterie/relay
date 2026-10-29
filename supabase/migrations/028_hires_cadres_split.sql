-- ════════════════════════════════════════════════════════════════
-- RELAYS — Entrées, cadres (RTT), jours de fractionnement
-- • profiles.hire_date : date d'entrée → acquisition automatique des CP (mois d'entrée compté en entier).
-- • profiles.is_cadre : accès à l'option RTT dans la demande.
-- • profiles.leave_split_days : jours de fractionnement ajoutés à la main par la RH (s'ajoutent aux jours acquis).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_cadre BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_split_days NUMERIC NOT NULL DEFAULT 0;

SELECT 'Date d''entrée, cadres et fractionnement prêts' AS info;
