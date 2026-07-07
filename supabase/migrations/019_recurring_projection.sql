-- ════════════════════════════════════════════════════════════════
-- RELAYS — Récurrence : projection calendrier + création anticipée
-- lead_days      : la carte réelle est créée ce nombre de jours AVANT
--                  l'échéance (l'échéance = la date de récurrence).
-- horizon_months : jusqu'où projeter les occurrences dans le calendrier
--                  (NULL = indéfiniment).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS lead_days INTEGER NOT NULL DEFAULT 3;
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS horizon_months INTEGER DEFAULT NULL;

-- La carte générée porte désormais une échéance (le jour prévu de récurrence).
-- (tasks.deadline existe déjà — rien à ajouter côté tasks.)

SELECT 'Récurrence projection prête (lead_days, horizon_months)' AS info;
