-- ════════════════════════════════════════════════════════════════
-- RELAYS — Compteurs de jours restants (congés & RTT)
-- Chaque personne saisit son solde de départ ; le décompte se fait
-- automatiquement (jours ouvrés) à la validation d'une absence.
-- ════════════════════════════════════════════════════════════════

-- Soldes de DÉPART saisis par la personne (droits annuels).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_balance_conges NUMERIC(5,1) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_balance_rtt    NUMERIC(5,1) DEFAULT NULL;

SELECT 'Compteurs congés/RTT prêts' AS info;
