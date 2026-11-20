// Durée de vie des cookies de connexion : 1 an, RENOUVELÉE à chaque visite (le middleware les réécrit).
// Une personne qui utilise RELAYS n'est donc jamais déconnectée ; seule la déconnexion volontaire (ou 1 an sans venir) l'efface.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365
