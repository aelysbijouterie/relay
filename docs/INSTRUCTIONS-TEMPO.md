# Liaison RELAYS ⇄ Tempo — instructions pour Claude (côté Tempo)

> À copier-coller tel quel dans la conversation Claude du projet **Tempo** (dépôt `pac-aelys`).
> Le côté RELAYS est déjà fait. Ici : uniquement ce que Tempo doit exposer et afficher.
> Aucun secret dans ce texte : la valeur du secret est donnée à part par Manon.

## Garde-fous (impératifs)
- **Aucun mail réel** ne doit partir à cause de cette liaison (ni boutiques, ni imprimeur, ni centres commerciaux). Créer une opération via la liaison ne déclenche **aucune** automatisation de mail.
- **Pas de SQL en production sans Manon** : donne-lui le SQL (fichier `supabase/migration-relays-liaison.sql`, ordre, vérification, projet `kpxqeufawhggjverbopq`), elle le colle dans Supabase → SQL Editor. Idempotent (`IF NOT EXISTS`) puis `NOTIFY pgrst, 'reload schema';`.
- Ne touche ni aux connexions, ni à la RLS. Commits : auteur `aelysbijouterie <aelys.bijouterie@gmail.com>`, seulement si Manon le demande (Vercel Hobby).
- Cadre d'abord, montre les maquettes pour l'affichage rouge, puis code.

## Principe
RELAYS (gestion de cartes) et Tempo (visuels des opérations commerciales) se synchronisent **dans les deux sens** :
- RELAYS **lit** Tempo toutes les heures (et à chaque appel du webhook) via `GET /api/sync/operations`.
- RELAYS **écrit** dans Tempo uniquement via `POST /api/sync/operations` : création d'une opération née dans RELAYS, lien avec la carte, dates saisies dans RELAYS, texte de dissonance.
- Tempo reste la référence pour les **étapes** (échéances ébauche / déclinaisons / impression / réception, validations, mails). RELAYS ne les modifie jamais.
- Pour les **dates de l'opération** (début/fin) : aucun écrasement automatique dans aucun sens. Si elles diffèrent → **dissonance** : affichée en rouge dans les deux applications + un e-mail **envoyé par RELAYS** à Manon. Tempo n'envoie pas de mail pour ça.

## 1. Variables d'environnement (Vercel Tempo)
| Nom | Valeur |
|---|---|
| `RELAYS_SYNC_SECRET` | le même secret que `TEMPO_SYNC_SECRET` côté RELAYS (donné par Manon, chaîne longue aléatoire, type *Sensitive*) |
| `RELAYS_WEBHOOK_URL` | `https://aelys-relays.vercel.app/api/tempo/webhook` |

## 2. Base de données Tempo (SQL à donner à Manon)
Sur la table des opérations (adapter le nom réel, relever-le dans `supabase/schema.sql`) :
```sql
ALTER TABLE operations ADD COLUMN IF NOT EXISTS relays_task_id    TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS relays_date_debut DATE;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS relays_date_fin   DATE;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS relays_conflit    TEXT;
CREATE INDEX IF NOT EXISTS idx_operations_relays_task ON operations(relays_task_id);
NOTIFY pgrst, 'reload schema';
```
Si Tempo a un champ CGV magasin / CGV web / mécanique / dates d'échéances, **réutiliser les colonnes existantes** (ne rien dupliquer).

## 3. `GET /api/sync/operations`
Auth : en-tête `Authorization: Bearer <RELAYS_SYNC_SECRET>` (comparaison à temps constant ; sinon 401). **Lecture seule.**
Réponse `200` :
```json
{ "operations": [ {
  "id": "identifiant stable de l'opération dans Tempo (texte)",
  "nom": "NOËL EN AVANT-PREMIÈRE",
  "date_debut": "2026-11-04",
  "date_fin": "2026-11-22",
  "mecanique": "texte ou null",
  "cgv_magasin": "texte ou null",
  "cgv_web": "texte ou null",
  "relays_task_id": "id de la carte RELAYS ou null",
  "echeances": {
    "ebauche": "2026-10-02", "declinaisons": "2026-10-09",
    "envoi_impression": "2026-10-12", "controle_reception": "2026-10-26"
  },
  "etat": {
    "ebauche_validee": true,
    "declinaisons_validees": true,
    "mail_imprimeur_envoye": true,
    "controle_reception_envoye": false
  }
} ] }
```
Définitions précises (à mapper sur les données réelles de Tempo, sans rien inventer) :
- dates au format `AAAA-MM-JJ`, `null` si inconnues ; chaînes vides → `null`.
- `echeances.*` : les dates d'échéance affichées dans l'onglet « Infos → Échéances » de l'opération (ébauche, déclinaisons, envoi impression, contrôle réception).
- `etat.ebauche_validee` : **au moins une** ébauche est validée.
- `etat.declinaisons_validees` : **toutes** les déclinaisons sont validées (et il y en a au moins une).
- `etat.mail_imprimeur_envoye` : le mail à l'imprimeur a **réellement été envoyé** (date d'envoi renseignée), pas seulement préparé.
- `etat.controle_reception_envoye` : le mail automatique de contrôle réception est **réellement parti**.
- N'inclure que les opérations non supprimées/archivées. Les opérations de **test** (boutique 999 / mode test) ne doivent pas être exposées.

## 4. `POST /api/sync/operations`
Même authentification. Corps JSON :
```json
{
  "relays_task_id": "…",
  "tempo_operation_id": "optionnel : id Tempo déjà lié",
  "nom": "SOLDES HIVER",
  "date_debut": "2027-01-06",
  "date_fin": "2027-02-02",
  "mecanique": "Pastillage sur tout",
  "relays": { "date_debut": "2027-01-06", "date_fin": "2027-02-02", "conflit": null }
}
```
Comportement :
1. **Opération déjà liée** (`tempo_operation_id` fourni, ou une opération a déjà ce `relays_task_id`) : **ne modifier NI le nom NI les dates NI la mécanique**. Enregistrer seulement `relays_task_id`, `relays_date_debut` ← `relays.date_debut`, `relays_date_fin` ← `relays.date_fin`, `relays_conflit` ← `relays.conflit` (texte ou `null`).
2. **Sinon** : créer l'opération avec `nom`, `date_debut`, `date_fin`, `mecanique`, en utilisant la **même logique que le formulaire « Nouvelle opération »** (échéances par défaut, etc.), **sans envoyer aucun mail** ; enregistrer `relays_task_id` et `relays_date_*`.
3. Idempotent : deux appels identiques ne créent jamais deux opérations (clé = `relays_task_id`).
4. Réponse `200` : `{ "id": "<id Tempo de l'opération>" }`. Erreur : code HTTP ≠ 200 avec un message clair (jamais de page HTML).

### 4 bis. Édition (année) et délien
- Deux opérations de même nom mais d'années différentes sont **deux opérations distinctes**. RELAYS ne rapproche une carte d'une opération que si les périodes se chevauchent ou si les débuts sont à moins de 60 jours.
- Si une carte a été liée par erreur à une autre édition, RELAYS envoie un POST avec `"delier": true` et `tempo_operation_id` : Tempo doit alors **effacer** `relays_task_id`, `relays_date_debut`, `relays_date_fin` et `relays_conflit` de cette opération (sans toucher à son nom, ses dates ni sa mécanique), et répondre `{ "id": "<id de cette opération>" }`.
- Ensuite RELAYS envoie un POST **sans** `tempo_operation_id` pour la nouvelle édition : Tempo crée alors une **nouvelle** opération (la clé `relays_task_id` n'est plus occupée).
- Une dissonance n'existe que pour une même édition : dates d'années différentes → aucun encadré rouge.

## 5. Affichage rouge de la dissonance (dans Tempo)
Quand `relays_conflit` n'est pas vide : afficher **en rouge**, de façon bien visible, sur le **planning**, le **tableau de bord** et la **fiche de l'opération** : « Dates différentes dans RELAYS — RELAYS : jj/mm/aaaa → jj/mm/aaaa · Tempo : … ». Dès que RELAYS renvoie `conflit: null`, l'alerte disparaît toute seule. **Proposer 2-3 maquettes avant de coder** (Manon préfère choisir le rendu).
Tempo n'envoie **pas** de mail pour une dissonance (RELAYS le fait).

## 6. Appel du webhook RELAYS (mise à jour immédiate)
Après chacun de ces événements, appeler **sans attendre la réponse et sans jamais faire échouer l'action** (try/catch, timeout 5 s, échec ignoré silencieusement — RELAYS rattrape de toute façon à l'heure suivante) :
`POST ${RELAYS_WEBHOOK_URL}` avec `Authorization: Bearer ${RELAYS_SYNC_SECRET}` et un corps `{}`.
Événements : création d'une opération, modification de ses dates / mécanique / CGV / échéances, validation d'une ébauche, validation d'une déclinaison, envoi du mail à l'imprimeur, envoi du mail de contrôle réception.
(Sur Vercel : le faire **avant** de répondre à la requête, avec un `await` court sous `Promise.race` de 5 s, car une promesse non attendue peut être coupée à la fin de la réponse.)

## 7. Ce que fait RELAYS de ces informations (pour comprendre)
- **Création dans Tempo → carte RELAYS** : carte « Opération commerciale » titrée `NOM - jj/mm - jj/mm`, modèle OPÉRATION COMMERCIALE (liste à cocher), mécanique, CGV (magasin + web) dans la description et le bloc Opération commerciale.
- **Échéance de la carte RELAYS** = étape en cours dans Tempo : ébauche → (une ébauche validée) déclinaisons → (toutes validées) envoi en impression → (mail parti) contrôle réception.
- **Sous-tâches cochées** : « Réalisation des visuels » ← `declinaisons_validees` ; « Envoi en impression » ← `mail_imprimeur_envoye` ; « Contrôle réception » ← `controle_reception_envoye` (jamais décochées par la liaison). Leurs échéances = `echeances.declinaisons`, `echeances.envoi_impression`, `echeances.controle_reception`.
- **Cartes RELAYS déjà existantes** (17 opérations 2027 : ventes privées hiver, soldes hiver, Saint-Valentin, Op Privilège, Les Beaux Jours, French Days de printemps, Fête des mères, Fête des pères, ventes privées été, soldes été, Petits prix été, Les Jours en or, French Days d'automne, L'Anniversaire Aélys, Noël en avant-première, Black Friday, Noël) : au premier passage, RELAYS les **envoie à Tempo** (`POST` ci-dessus) avec nom, dates et mécanique. Si Tempo a déjà une opération de **même nom** (insensible aux accents/majuscules), RELAYS la **rapproche** au lieu d'en créer une (d'où l'importance que `nom` soit sans date dans `GET`).

## 8. Tests à faire (sans rien envoyer à personne)
1. `curl` `GET /api/sync/operations` sans secret → 401 ; avec secret → liste.
2. `POST` avec une opération fictive nommée `TEST LIAISON` → créée, aucun mail parti ; rappeler le même `POST` → pas de doublon ; puis supprimer l'opération de test (avec l'accord de Manon).
3. `POST` avec `relays.conflit` renseigné → alerte rouge visible ; avec `conflit: null` → disparaît.
4. Vérifier que le webhook n'empêche jamais une validation / un envoi de fonctionner s'il est injoignable.
Quand c'est déployé : dire à Manon de cliquer sur **« Synchroniser avec Tempo »** dans RELAYS (page Opérations & Média Kit).
