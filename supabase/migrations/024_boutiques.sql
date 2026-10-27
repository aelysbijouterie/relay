-- ════════════════════════════════════════════════════════════════
-- RELAYS — Version boutiques
-- 1 compte par boutique (profil is_boutique_account) + collaborateurs
-- (profils sans connexion) rattachés à la boutique. Les demandes de
-- congés des boutiques sont validées uniquement par la RH
-- (profil can_validate_boutiques = Chloé Estangoy).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS boutiques (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        INT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  city        TEXT,
  email       TEXT,
  responsable TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE boutiques ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boutique_id UUID REFERENCES boutiques(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_boutique_account BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_validate_boutiques BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_boutique ON profiles(boutique_id) WHERE boutique_id IS NOT NULL;

-- Service technique « Boutiques » (regroupe les comptes et collaborateurs de magasin)
INSERT INTO departments (name, slug, color)
SELECT 'Boutiques', 'boutiques', '#0E7C86'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE slug = 'boutiques');

-- Les 23 boutiques (source : Coordonnées-magasins-Aelys.xlsx)
INSERT INTO boutiques (code, name, city, email, responsable) VALUES
  (200, 'Aélys Pau Est', 'PAU', 'pau-est@aelys.fr', 'Audrey'),
  (300, 'Aélys Montauban Nord', 'MONTAUBAN', 'montauban-nord@aelys.fr', 'Alison'),
  (302, 'Aélys Castres', 'CASTRES', 'castres@aelys.fr', 'Virginie'),
  (303, 'Aélys Saint-André', 'SAINT-ANDRE-DE-CUBZAC', 'st-andre@aelys.fr', 'Valérie'),
  (304, 'Aélys Marsac', 'MARSAC SUR L''ISLE', 'marsac@aelys.fr', 'Christelle'),
  (305, 'Aélys Ibos', 'IBOS', 'meridien.ibos@aelys.fr', 'Stéphanie'),
  (306, 'Aélys Boé', 'BOE', 'boe@aelys.fr', 'Charlène'),
  (309, 'Aélys Bouliac', 'BOULIAC', 'bouliac@aelys.fr', 'Delphine'),
  (310, 'Aélys Lescar', 'LESCAR', 'lescar@aelys.fr', 'Elodie'),
  (312, 'Aélys Dax', 'SAINT-PAUL-LES-DAX', 'dax@aelys.fr', 'Florence'),
  (313, 'Aélys Le Pian Médoc', 'LE PIAN MEDOC', 'lepian@aelys.fr', 'Anais'),
  (401, 'Aélys Tinqueux', 'TINQUEUX', 'reims.tinqueux@aelys.fr', 'Allyson'),
  (402, 'Aélys Nemours', 'NEMOURS', 'nemours@aelys.fr', 'Valérie'),
  (404, 'Aélys Longeville Les Saint Avold', 'LONGEVILLE-LES-SAINT-AVOLD', 'saint-avold@aelys.fr', 'Sabrina'),
  (408, 'Aélys Ales', 'ALES', 'ales@aelys.fr', 'Muriel'),
  (409, 'Aélys Villers semeuse', 'VILLERS-SEMEUSE', 'villers-semeuse@aelys.fr', 'Stéphanie'),
  (411, 'Aélys Cherbourg', 'CHERBOURG-EN-COTENTIN', 'cherbourg.glacerie@aelys.fr', 'Julie'),
  (413, 'Aélys Vitrolles', 'VITROLLES', 'vitrolles@aelys.fr', 'Ludivine'),
  (414, 'Aélys Saint Nazaire', 'SAINT-NAZAIRE', 'saint.nazaire@aelys.fr', 'Aurore'),
  (420, 'Aélys Colmar', 'HOUSSEN', 'colmar@aelys.fr', 'Marie'),
  (421, 'Aélys Cabries', 'CABRIES', 'cabries@aelys.fr', NULL),
  (422, 'Aélys La Valette du Var', 'LA VALETTE DU VAR', 'toulon.lavalette@aelys.fr', 'Elodie'),
  (423, 'Aélys Collegien', 'COLLEGIEN', 'torcy@aelys.fr', 'Caroline')
ON CONFLICT (code) DO NOTHING;

-- Chloé Estangoy (RH) : seule à valider les demandes des boutiques,
-- et accès au service « Boutiques » dans le sélecteur de services.
UPDATE profiles
SET can_validate_boutiques = true,
    extra_department_ids = (
      SELECT ARRAY(SELECT DISTINCT unnest(
        COALESCE(extra_department_ids, '{}'::uuid[]) || (SELECT id FROM departments WHERE slug = 'boutiques')
      ))
    )
WHERE lower(email) = 'chloe.estangoy@aelys.fr';

SELECT (SELECT count(*) FROM boutiques) AS boutiques,
       (SELECT count(*) FROM profiles WHERE can_validate_boutiques) AS validateurs_rh;
