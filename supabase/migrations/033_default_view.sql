-- RELAYS — Vue favorite par personne  (À EXÉCUTER PAR MANON, une seule fois)
-- Page sur laquelle l'application s'ouvre toujours (Kanban, Calendrier, Focus du jour…), réglée dans Compte > Profil.
-- Sans cette colonne, le réglage fonctionne quand même sur le navigateur utilisé ; avec elle, il suit la personne partout.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_view TEXT;
