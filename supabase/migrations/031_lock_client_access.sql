-- RELAYS — Fermer l'accès direct à la base depuis le navigateur  (À EXÉCUTER PAR MANON, après lecture)
--
-- Pourquoi : l'application lit et écrit TOUJOURS par le serveur (clé « service_role »). Or un utilisateur connecté peut
-- récupérer son jeton (/api/auth/realtime-token) et, avec la clé publique, interroger Supabase directement : les règles
-- RLS actuelles (migration 001) lui montrent alors toutes les cartes et tous les profils de SON service, ce qui contourne
-- la règle « créateur + assignés ». Pour les magasins (tous dans le service « Boutiques »), cela expose aussi les profils
-- des autres magasins.
--
-- Effet de cette migration : les rôles « anon » et « authenticated » n'ont plus aucun droit sur les tables du schéma public.
-- Le serveur (service_role) n'est pas concerné : l'application continue de fonctionner normalement.
-- Seul changement visible : le temps réel du Kanban (mise à jour instantanée chez les autres) ne reçoit plus d'événements ;
-- la liste se rafraîchit alors toutes les 30 secondes (SWR) et à chaque retour sur l'onglet. Aucune perte de données.
--
-- Retour arrière possible : GRANT SELECT ON public.tasks TO authenticated;  (et les autres tables au besoin).

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Les tables créées plus tard ne donnent pas non plus de droit par défaut.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Contrôle : doit renvoyer 0 ligne.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');
