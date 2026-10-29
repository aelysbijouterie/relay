# CLAUDE.md — Projet RELAYS (Aelys Bijouterie)

> Document de référence **complet** du projet, destiné à Claude Code. Il remplace l'ancien `CLAUDE.md`
> (obsolète : anciennes couleurs, 6 services au lieu de 8, aucune des fonctionnalités récentes).
> Dernier état vérifié : dépôt `aelysbijouterie/relay`, branche `main`, commit `3c4d8ec`
> (« PAC Media Kit : date de fin dediee + affichage permanent »).

---

## Sommaire

1. [Contexte et personnes](#1-contexte-et-personnes)
2. [Règles de collaboration (à lire en premier)](#2-règles-de-collaboration-à-lire-en-premier)
3. [Stack technique](#3-stack-technique)
4. [Arborescence du projet](#4-arborescence-du-projet)
5. [Authentification et sessions](#5-authentification-et-sessions)
6. [Base de données](#6-base-de-données)
7. [Charte graphique](#7-charte-graphique)
8. [Règles de visibilité (critique)](#8-règles-de-visibilité-critique)
9. [Fonctionnalités, module par module](#9-fonctionnalités-module-par-module)
10. [Notifications, e-mails et tâches planifiées](#10-notifications-e-mails-et-tâches-planifiées)
11. [Design de la carte Kanban — leçons CSS](#11-design-de-la-carte-kanban--leçons-css)
12. [Pièges connus et incidents passés](#12-pièges-connus-et-incidents-passés)
13. [État des livraisons : en production / non poussé](#13-état-des-livraisons--en-production--non-poussé)
14. [Backlog et décisions en attente](#14-backlog-et-décisions-en-attente)
15. [Sécurité — actions urgentes](#15-sécurité--actions-urgentes)
16. [Annexe A — SQL des migrations 022 et 023 (absentes du dépôt)](#annexe-a--sql-des-migrations-022-et-023-absentes-du-dépôt)
17. [Annexe B — Commandes Windows de mise en ligne](#annexe-b--commandes-windows-de-mise-en-ligne)

---

## 1. Contexte et personnes

**RELAYS** est une application web de gestion de tâches (Kanban) sur mesure pour **Aelys Bijouterie**
(vente et distribution de bijoux, environ **20 collaborateurs**, **8 services**).

| Élément | Valeur |
|---|---|
| Dépôt GitHub | `github.com/aelysbijouterie/relay` (dépôt public) |
| Production | https://aelys-relays.vercel.app |
| Hébergement | Vercel (déploiement automatique à chaque push sur `main`) |
| Projet Supabase | référence `bgecqghthqxdyozvbrjx` |
| Dossier local de Manon | `C:\Users\manon\relays` |
| Langue de l'interface | **Français** (tous les textes visibles, y compris les e-mails) |

**Interlocutrice : Manon Mignot** — administratrice, **non technique**. Environnement : **Windows**, Bloc-notes,
invite de commandes **`cmd`** (pas PowerShell — voir §12). Elle pousse **directement sur `main`** ; Vercel déploie.

**Une seule base Supabase est partagée** entre le développement local et la production : une migration SQL
ne s'exécute donc **qu'une seule fois**, et les tests locaux écrivent dans les vraies données.

**Services (slugs en base) :** `marketing`, `web`, `comptabilite`, `direction`, `direction-regionale`,
`logistique`, `rh`, `administratif`.

---

## 2. Règles de collaboration (à lire en premier)

Ces règles viennent de nombreuses sessions de travail et d'incidents réels. Elles sont **impératives**.

### 2.1 Communication
- Répondre **en français**, avec des mots simples. Manon n'est pas développeuse : expliquer le « pourquoi »
  d'un changement en une ou deux phrases, pas le détail technique.
- Quand on lui donne des commandes à taper, **donner TOUTES les étapes, dans l'ordre, prêtes à copier-coller
  dans `cmd`**, avec le point de contrôle attendu après chaque étape (« doit afficher… »). Elle l'a demandé
  explicitement et à plusieurs reprises.
- Être **honnête sur les limites** : Claude n'a pas accès à la base de données Supabase de production. Pour lire
  ou modifier des données, fournir une requête SQL qu'elle exécute elle-même dans *Supabase → SQL Editor*
  (et lui rappeler de vérifier qu'elle est sur le **bon projet** : `bgecqghthqxdyozvbrjx`).
- Ne pas mentionner de secrets (mots de passe, clés) dans les réponses ni dans le dépôt.

### 2.2 Cadrage avant de coder
- Pour toute fonctionnalité non triviale : **poser des questions de cadrage d'abord** (visibilité, champs,
  cas limites). Manon l'attend et le demande (« pose-moi des questions avant de développer »).
- Pour tout changement **visuel** : proposer d'abord **plusieurs maquettes HTML** (5 à 9 variantes) qu'elle
  ouvre dans le navigateur, puis coder **uniquement** la variante choisie. Ne jamais déployer à l'aveugle un
  changement visuel complexe — plusieurs allers-retours ont été perdus sur la barre colorée des cartes (§11).
- Ne pas empiler des changements non demandés. Un patch = un sujet clair.

### 2.3 Qualité avant livraison
Avant tout commit proposé :
1. `npx tsc --noEmit` (aucune erreur)
2. `npx next build` → « Compiled successfully »
3. Tester la **logique métier** avec un petit script Node quand c'est possible (calculs de dates, règles de
   visibilité, tri). Les tests de visibilité ont évité plusieurs régressions.
4. **Ne jamais committer** de fichiers `*.patch`, `*.log`, `*.zip`, ni de dossier `.next`.

### 2.4 Migrations SQL
- Claude Code **ne peut pas exécuter** de SQL sur Supabase. Fournir la migration **dans le chat en bloc de code**
  (Manon n'arrive pas toujours à télécharger un fichier `.sql`) et la **versionner aussi** dans
  `supabase/migrations/NNN_nom.sql`.
- Numérotation actuelle : dernière migration versionnée = `021`. Les migrations `022` et `023` ont été
  exécutées à la main et **ne sont pas dans le dépôt** → les ajouter (SQL en Annexe A).
- Toujours écrire des migrations **idempotentes** (`IF NOT EXISTS`).

### 2.4bis Si Claude Code travaille directement dans le dépôt
Historiquement, les modifications étaient livrées sous forme de **patchs git** testés sur un clone frais
(`git apply --check`). Avec Claude Code dans `C:\Users\manon\relays`, les patchs deviennent inutiles :
travailler en commits directs, mais **conserver** les contrôles du §2.3 et ne pousser qu'après un build propre.

### 2.5 Procédure de retour arrière (incident connu)
Si une mise en production casse l'app : *Vercel → Deployments → déploiement précédent → ⋯ → Promote to Production*.
⚠️ Cela ne change **pas** l'historique Git : `origin/main` garde le mauvais commit. Corriger ensuite dans Git,
sinon le prochain push redéploie le bug.

---

## 3. Stack technique

| Domaine | Choix |
|---|---|
| Framework | **Next.js 14** (App Router), **TypeScript strict** |
| UI | Tailwind CSS, composants Radix UI (dialog, tabs, select, popover…), `lucide-react`, `sonner` (toasts) |
| Thème | `next-themes` — **clair par défaut** + sombre |
| Police | **Inter** |
| Données | **Supabase** (PostgreSQL). Lectures/écritures serveur via le **client admin (service role)** |
| État client | **Zustand** (`src/store/tasks.ts`) + **SWR** (`useTasks`, rafraîchissement 30 s + à la focalisation) |
| Temps réel | `useRealtimeTasks` (Supabase Realtime) |
| Glisser-déposer | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Formulaires | `react-hook-form` + `zod` (`src/lib/validations/task.ts`) |
| Dates | `date-fns` (locale `fr`) + helpers maison |
| E-mails | `nodemailer` (SMTP OVH) ; `resend` présent dans les dépendances |
| Déploiement | Vercel + **Vercel Cron** (`vercel.json`) |

Scripts : `npm run dev`, `npm run build`, `npm run lint`, `npm run type-check`.

**Variables d'environnement** (Vercel + `.env.local`) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
`NEXT_PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TEST_EMAIL`.
Variable optionnelle (fonction IA non déployée, §14) : `GEMINI_API_KEY`.

---

## 4. Arborescence du projet

```
relays/
├── CLAUDE.md                     ← ce document
├── vercel.json                   ← crons
├── scripts/create-users.mjs      ← création de comptes en masse
├── supabase/migrations/          ← 001…021 (+ voir Annexe A pour 022, 023)
└── src/
    ├── middleware.ts             ← redirections login / cookies relays-session & relays-demo
    ├── app/
    │   ├── (auth)/ login, mot-de-passe-oublie, reinitialiser-mot-de-passe
    │   ├── (dashboard)/
    │   │   ├── layout.tsx        ← charge profil, services, tâches (fallback SSR) ; AccentProvider
    │   │   ├── kanban/           ← tableau Kanban
    │   │   ├── ma-todo/          ← « Focus du jour »
    │   │   ├── calendrier/       ← calendrier personnel
    │   │   ├── conges/           ← module Congés / absences
    │   │   ├── pac-media-kit/    ← planning PAC & Média Kit (Marketing + Web)
    │   │   ├── timeline/         ← chronologie
    │   │   ├── stats/            ← statistiques
    │   │   ├── activite/         ← journal d'activité
    │   │   ├── archives/ · corbeille/
    │   │   └── compte/           ← profil, préférences
    │   └── api/                  ← voir §4.1
    ├── components/
    │   ├── kanban/    KanbanBoard, KanbanColumn, KanbanBoardServer
    │   ├── tasks/     TaskCard, TaskModal, NewTaskModal
    │   ├── todo/      TodoView
    │   ├── calendar/  CalendarView, EventModal
    │   ├── absences/  AbsencesView, NewAbsenceModal, ActivityPeriodModal, LeaveBalance
    │   ├── recurring/ RecurringModal
    │   ├── pac-media-kit/ PacMediaKitView
    │   ├── stats/ · timeline/ · activity/ · archives/ · trash/ · account/
    │   ├── layout/    Sidebar, Header, AccentProvider
    │   ├── providers/ TasksProvider, TasksLoader
    │   └── brand/     Logo
    ├── lib/
    │   ├── actions/ (tasks.ts, auth.ts…)   ← server actions
    │   ├── tasks/    visibility.ts, deadline.ts, todoScore.ts
    │   ├── absences/ workdays.ts           ← jours ouvrés (exclut les fériés)
    │   ├── calendar/ holidays.ts           ← fériés + vacances scolaires zone B
    │   ├── recurring/ schedule.ts          ← isDue + occurrencesInRange
    │   ├── supabase/ client.ts, server.ts, session.ts
    │   ├── validations/task.ts             ← schéma Zod
    │   ├── email.ts, notify.ts, utils.ts, demo-data.ts
    │   └── server/fetchTasks.ts
    ├── emails/   baseHtml.ts, templates.ts ← gabarits HTML des e-mails (charte)
    ├── hooks/    useTasks.ts, useRealtimeTasks.ts
    ├── store/    tasks.ts (Zustand)
    └── types/    index.ts, absences.ts, recurring.ts, calendarEvents.ts, pacMediaKit.ts
```

### 4.1 Routes API (toutes dans `src/app/api/`)
`absences` (+ `[id]`, `balance`, `overlap`) · `account` (+ `avatar`) · `activity` · `activity-periods` (+ `[id]`) ·
`auth/` (`login`, `demo`, `realtime-token`, `switch-dept`) · `calendar-events` (+ `[id]`) ·
`cron/` (`recurring`, `deadlines`, `weekly`, `archive`, `stale`) · `departments` (+ `[id]/settings`) ·
`notify/` (`assign`, `comment`, `deadline`, `status`, `subtask-assign`, `absence-request`, `absence-review`) ·
`pac-media-kit` · `profiles` · `recurring` (+ `[id]`, `[id]/materialize`) · `stats/team` · `tags` ·
`tasks` (+ `[id]`, `[id]/activity|attachments|comments|duplicate|restore|subtasks|tags`,
`archived`, `bulk`, `reorder`, `trash`) · `templates` (+ `[id]`) · `debug`.

---

## 5. Authentification et sessions

- Connexion par e-mail + mot de passe : `supabase.auth.signInWithPassword`.
- Session = **cookie httpOnly `relays-session`** contenant `{ access_token, user_id, email }`.
  Les routes API lisent `user_id` dans ce cookie (fonction locale `getUserId()` répétée dans chaque route).
- Mode démo : cookie `relays-demo` + `lib/demo-data.ts`.
- **Service actif** (sélecteur de service dans la sidebar) : cookie `relays-active-dept`, posé par
  `api/auth/switch-dept`. Changer de service fait un `window.location.reload()` (pas `router.refresh()`)
  pour réinitialiser tout l'état client.
- ⚠️ **Toutes les lectures serveur passent par le client admin (service role), qui contourne la RLS.**
  Le filtrage **applicatif** (§8) est donc la **seule** barrière de confidentialité. Toute nouvelle route
  qui lit des tâches doit appliquer la règle de visibilité.

**Cas particulier — comptes sans e-mail (ex. Emeric Gardelle)** : colonne `profiles.email` **non unique** ;
le login se fait avec une adresse interne et les notifications partent vers une autre adresse. Configuré
directement dans Supabase (aucun code).

**Gestionnaires multi-services (ex. Audrey Arees)** : service principal Comptabilité + `extra_department_ids`
= [RH, Administratif]. Le service actif détermine ce qu'elle valide dans Congés.

---

## 6. Base de données

⚠️ Le dossier `supabase/migrations/` **n'est pas une source de vérité complète** (numéros 005, 006, 008, 010
absents ; 022 et 023 exécutées à la main). **La base réelle fait foi.** En cas de doute, demander à Manon
d'exécuter une requête de vérification dans Supabase.

### 6.1 Tables utilisées par le code
`tasks`, `profiles`, `departments`, `task_assignees`, `task_departments` (services supplémentaires d'une carte),
`task_subtasks`, `subtask_assignees`, `task_comments`, `task_attachments`, `task_activity`, `task_templates`,
`tags`, `task_tags`, `saved_filters`, `recurring_tasks`, `absences`, `activity_periods`, `calendar_events`.

### 6.2 `tasks` (colonnes importantes)
`id, title, description, status, priority, department_id, created_by, deadline (DATE), position (NUMERIC),
is_cross_team, fournisseur_client, ref_collection, parent_task_id, recurring_task_id, completed_at,
deleted_at, deleted_by` (corbeille = suppression logique) `, created_at, updated_at`,
et les champs **PAC & Média Kit** : `op_category, op_date_debut, op_date_fin, op_mecanique, op_cgv,
op_exclusions, op_commentaires, op_montant, op_references` (Annexe A).

- **Statuts (valeur stockée)** : `'A Faire'`, `'En cours'`, `'Bloqué'`, `'A revoir'`, `'Terminé'`, `'Archivé'`.
  ⚠️ `'A revoir'` est la **valeur technique** (contrainte CHECK) ; elle s'**affiche « À valider »** via
  `STATUS_LABELS` (`src/types/index.ts`). Ne **jamais** renommer la valeur en base : utiliser `STATUS_LABELS`
  pour tout affichage (colonne Kanban, boutons de statut, filtres, stats, chronologie).
- **Priorités** : `'Urgent'`, `'Élevée'`, `'Moyenne'`, `'Faible'`.
- `deadline` est un **DATE** ; `task_subtasks.deadline` est un **TIMESTAMPTZ**. Attention aux comparaisons
  (toujours `.slice(0, 10)` pour comparer des jours).

### 6.3 `profiles`
`id, name, email` (**non unique**), `department_id, extra_department_ids UUID[], role` (CHECK
`'admin' | 'manager' | 'collaborateur'`), `avatar_url` (bucket `avatars`), `is_active`,
`notify_email_assigned|status|deadlines|weekly|mentions`, `leave_balance_conges`, `leave_balance_rtt` (NUMERIC),
`show_holidays`, `show_school_holidays`, `show_absences_calendar` (défaut `false`), `conges_default_dept_ids UUID[]`.

### 6.4 Autres tables
- **`task_subtasks`** : `id, task_id, title, is_done, group_name, position, deadline, created_by, created_at`.
- **`absences`** : `user_id, type` (CHECK : Congés payés, RTT, Maladie, Télétravail, Alternance, Autre),
  `start_date, end_date, start_period/end_period` (`full|am|pm`), `reason, status`
  (En attente / Validé / Refusé / Modif. en attente), `reviewed_by/at, review_note`,
  + `pending_start_date/pending_end_date/pending_start_period/pending_end_period` (demande de modification).
- **`activity_periods`** : périodes « congés déconseillés » par service : `department_id, label, start_date, end_date, created_by`.
- **`recurring_tasks`** : `title, description, priority, department_id, created_by, frequency`
  (CHECK `weekly|monthly_day|monthly_first|monthly_last|daily`), `weekday, month_day, assignee_ids UUID[],
  is_active, last_run_date, lead_days INT DEFAULT 3, horizon_months INT NULL`.
- **`calendar_events`** (migration 021) : `title, event_date, event_time, note, category`
  (`reunion|anniversaire|autre`), `is_recurring_yearly, is_shared, department_id, created_by`.

---

## 7. Charte graphique (verrouillée)

- Thème **clair par défaut**, sombre disponible. Police **Inter**.
- **Logo** = « trois cartes translucides » : arrière bleu `#4891BE` (opacité 0,45), milieu violet `#7E6FB0` (0,7),
  avant rose `#D1608F` (0,95).
- **Couleur d'accent par service** (injectée en `--accent` par `AccentProvider`) :

| Service | Couleur |
|---|---|
| Marketing | `#E0596A` |
| Web | `#D456A0` |
| Logistique | `#2A9D8F` |
| RH | `#3E8FCC` |
| Comptabilité | `#8A9A3F` |
| Administratif | `#8B72C4` |
| Direction | `#5B6B8C` |
| Direction Régionale | `#C08A3E` |

- **Statuts** (variables CSS `--status-*`) : à faire `#94A3B8`, en cours `#3B82F6`, bloqué `#EF4444`,
  à valider `#F59E0B`, terminé `#1F9D57`, archivé `#6B7280`.
- Hauteur du bandeau : variable CSS `--header-height` = **64 px** (le bloc logo de la sidebar a la même hauteur,
  pour un alignement parfait).
- Couleurs propres aux **absences** (distinctes des couleurs de services) : `ABSENCE_COLORS` dans `types/absences.ts`.
- Catégories **PAC & Média Kit** : Opération commerciale `#E0596A`, Média Kit `#3B82F6`.
- Catégories d'**événements de calendrier** : réunion `#3B82F6`, anniversaire `#F59E0B`, autre `#8B72C4`.
- Dette connue : ~30 couleurs hexadécimales en dur dispersées (ex. `#94A3B8` ×17, `#EF4444` ×11) →
  envisager `src/lib/colors.ts`.

---

## 8. Règles de visibilité (critique)

C'est le sujet qui a causé le plus d'incidents. **Lire attentivement avant de toucher aux lectures de tâches.**

### 8.1 Principe général
**Une carte n'est visible que par sa créatrice et ses assigné(e)s. Jamais par « tout le service ».**
Le partage se fait **uniquement** en assignant explicitement quelqu'un. Règle identique pour tous les rôles
(admin compris). Implémentation : `isTaskVisibleTo(task, { userId })` dans `src/lib/tasks/visibility.ts`.

Appliquée à **trois endroits** (à garder synchronisés) :
1. `GET /api/tasks` (`src/app/api/tasks/route.ts`)
2. le chargement initial SSR dans `src/app/(dashboard)/layout.tsx` (fallback SWR)
3. (Archives et Corbeille ont leur propre filtre strict équivalent, voir ci-dessous)

### 8.2 Tableau récapitulatif

| Surface | Règle |
|---|---|
| **Kanban**, **Focus du jour**, **Chronologie**, **Activité** | créateur **ou** assigné (via la liste `tasks` déjà filtrée) |
| **Filtre Kanban « Mes tâches »** | tout ce qui est visible (créé ou assigné) |
| **Filtre Kanban « Créées par moi »** | créées par moi **sans** que j'y sois assigné(e) (délégation) |
| **Calendrier (tâches)** | uniquement mes tâches (assigné ou créateur) ; projections récurrentes : mes modèles uniquement |
| **Archives** et **Corbeille** | **strictement personnelles** (créateur ou assigné), même dans un même service |
| **Statistiques** « Moi » | mes tâches ; « Mon équipe » (managers/admins) : `api/stats/team`, **par service actif** — ⚠️ seule exception « équipe » restante, à arbitrer (§14) |
| **Événements de calendrier** | personnel (créateur seul) **ou** partagé avec le **service du créateur** (`is_shared` + `department_id`) |
| **Congés** | validation par les managers du service (principal ou additionnel via `extra_department_ids`) ; calendrier d'équipe filtrable par service |
| **PAC & Média Kit** | **exception volontaire** : toutes les cartes `op_category` non nulle des services **Marketing + Web**, visibles par tout membre de ces deux services (via `api/pac-media-kit`) |

### 8.3 Historique (pour ne pas refaire les mêmes erreurs)
1. Un ancien commit (`7057e21`, « visibilité personnelle ») avait déjà restreint toute l'API aux cartes créées/assignées.
2. On l'a retiré (« équipe partagée »), mais **sans le remplacer** → **chaque personne voyait toutes les cartes de
   toute l'entreprise** (incident, retour arrière Vercel).
3. Modèles intermédiaires essayés : « service + créateur + assigné », puis « carte personnelle vs carte d'équipe »
   (privée tant que seule la créatrice est concernée). Insatisfaisants : une carte « d'équipe » restait visible par
   tout le service, y compris des personnes non concernées.
4. **Décision finale de Manon** : *« uniquement créateur + assigné(s), jamais tout le service par défaut ».*
   Conséquence validée : le filtre « Tout » du Kanban a été **supprimé** (redondant avec « Mes tâches »).

### 8.4 Points d'attention / limites connues
- Les routes de **sous-ressources** (`tasks/[id]/subtasks`, `comments`, `attachments`, `activity`…) **ne
  vérifient pas** la visibilité : elles répondent à toute personne connaissant l'`id`. Cela permet d'ouvrir une
  carte PAC depuis le planning, mais c'est une faiblesse de confidentialité à durcir (§14).
- `getUserDepartmentIds()` existe toujours dans `visibility.ts` : il sert désormais **uniquement** à
  `api/calendar-events` (partage d'événements par service). Ne pas le supprimer.
- Ne jamais réintroduire un partage « par service » sur les tâches sans décision explicite de Manon.

---

## 9. Fonctionnalités, module par module

### 9.1 Kanban (`/kanban`)
- 5 colonnes visibles : À faire · En cours · Bloqué · À valider · Terminé (+ `Archivé` hors tableau).
- Glisser-déposer (`position` NUMERIC pour l'ordre dans une colonne), **recherche** (titre, description, fournisseur/client, collection, tags, noms d'assignés), filtre **« Mes tâches / Créées par moi »**.
- **Mode sélection / actions groupées** (`api/tasks/bulk`) : déplacer vers un statut, changer la priorité, assigner,
  archiver, supprimer plusieurs cartes à la fois (sélecteur « Déplacer vers » : libellés via `STATUS_LABELS`).
- **Cartes récurrentes** (voir 9.8) : une carte issue d'un modèle n'apparaît dans le Kanban que dans la fenêtre
  `lead_days` avant son échéance (`inLeadWindow()`).
- **Auto-assignation du créateur** : à la création d'une carte, la créatrice est **cochée par défaut** dans les
  assignés. C'est ce qui fait de la carte « sa todo » tant qu'elle ne se retire pas.
- **Modèles de cartes** (`task_templates`) : « Partir d'un modèle » affiche des puces ; une croix (au survol)
  supprime un modèle (`DELETE /api/templates/[id]`, confirmation, partagé par toute l'équipe).
- Titre de carte et titres de sous-tâches **modifiables en ligne**.

### 9.2 Carte (`TaskCard`) — voir aussi §11
- Titre, priorité, assignés, **progression des sous-tâches** (`x/y` + barre), échéance, badges.
- **Échéance effective** (`src/lib/tasks/deadline.ts`) : si la carte **n'a pas** d'échéance propre, on affiche la
  plus proche échéance parmi ses **sous-tâches non cochées**, suivie de « (sous-tâche) ». Quand on coche cette
  sous-tâche, la suivante prend sa place automatiquement (la modale appelle `refresh()` SWR).
  Utilisée par le **Kanban** *et* le **Focus du jour** (cohérence garantie par la fonction partagée).
- Badge rouge **« En retard »** (calculé sur l'échéance effective) + contour rouge.
- Badge ambre **« En pause depuis X j »** : statut actif (`A Faire`, `En cours`, `Bloqué`), **≥ 7 jours** sans
  modification (`updated_at`), valeur **dynamique**, masqué si la carte est déjà « en retard ».

### 9.3 Fenêtre de carte (`TaskModal`)
Onglets : Détails · Sous-tâches · Commentaires · Pièces jointes · Historique.
- **Description** : champ d'édition large (8 lignes, redimensionnable) ; affichage et commentaires avec
  `whitespace-pre-wrap` → **les retours à la ligne sont conservés**.
- **Sous-tâches** : groupes, glisser-déposer, échéance par sous-tâche, assignés par sous-tâche, e-mail à
  l'assignation, **auto-assignation** à la création. **Décalage en bloc** : case de sélection (à côté de la case
  « fait ») sur les sous-tâches ayant une échéance ; une barre permet de décaler les échéances sélectionnées de
  ±N jours.
- **Bloc PAC & Média Kit** (Marketing/Web) : voir 9.11. Affiché **en permanence** en lecture seule sous la description
  quand `op_category` est renseignée, et éditable en mode « Modifier ».
- Actions : modifier, dupliquer, archiver, supprimer (corbeille), restaurer, joindre des fichiers, commenter.

### 9.4 Focus du jour (`/ma-todo`, `src/lib/tasks/todoScore.ts`)
`focusOfDay(tasks, limit = 6)` renvoie **au plus 6 cartes**, dans cet ordre :
1. **Urgentes** (en retard, aujourd'hui, demain, cette semaine) triées par `todoScore`
   (score d'échéance + poids de priorité ×30 + poids de statut ×8) ;
2. **Échéances lointaines** (> 7 jours), « presque finies d'abord » (moins de sous-tâches restantes), puis score ;
3. **Sans échéance du tout**, **toujours visibles en bas**, triées par **priorité** (Urgent → Faible).
   *Décision validée* : ne pas attendre que la semaine soit « vide » (sinon elles ne remonteraient jamais).
L'échéance utilisée est l'**échéance effective** (sous-tâches comprises) ; l'étiquette indique « (sous-tâche) ».
⚠️ Limite connue : les jours chargés, le plafond de 6 peut exclure toute carte sans échéance
(réserver 1–2 places = idée en attente, §14).

### 9.5 Calendrier personnel (`/calendrier`)
- Vues mois/semaine ; **uniquement mes tâches**.
- **Jours fériés** (2025–2027) et **vacances scolaires zone B** (`lib/calendar/holidays.ts`,
  arrêté du 22/10/2025) ; bascules dans le profil (`show_holidays`, `show_school_holidays`).
- Option **« Mes congés »** (`show_absences_calendar`) : affiche **mes propres** absences validées.
- **Projections de récurrentes** : occurrences à venir sous forme de pastilles fantômes `↻ titre`
  (cliquables → détail + « Ouvrir la carte complète » via `POST /api/recurring/[id]/materialize`).
- **Événements de calendrier** (réunions, anniversaires…) : bouton « + » au survol d'un jour ; titre, date, heure
  optionnelle, note, catégorie (couleur), **récurrence annuelle**, visibilité **personnelle ou partagée avec le
  service**. **Indépendants du Kanban** : jamais affichés dans le Kanban (aucune référence dans `components/kanban`).
  Seul le **créateur** peut modifier/supprimer.

### 9.6 Congés / absences (`/conges`)
- Types : Congés payés, RTT, Maladie, Télétravail, **Alternance**, Autre.
- Demandes avec périodes demi-journée (`full|am|pm`), **validation** par les managers, demande de
  **modification** (`pending_*`), alertes de **chevauchement** (`api/absences/overlap`).
- **Compteurs de solde** (congés / RTT) — `LeaveBalance`, `api/absences/balance`.
- **Jours ouvrés** : `lib/absences/workdays.ts` exclut week-ends **et jours fériés**.
- **Périodes d'activité** (`activity_periods`) : plages « congés déconseillés » par service, affichées **en rouge**
  dans le calendrier **avec leur motif visible directement dans la cellule** (pas seulement en infobulle).
- Calendrier d'équipe : pastille par absence ; pour le type **Alternance**, le libellé est « **Alternance Prénom** »
  (et non le prénom seul). Bouton « +N — tout voir » pour les jours chargés.
- Filtres par service ; services par défaut mémorisés par profil (`conges_default_dept_ids`).
- Notifications e-mail : `notify/absence-request`, `notify/absence-review`.

### 9.7 Statistiques (`/stats`)
- Deux portées : **Moi** / **Mon équipe** (managers/admins, `api/stats/team`).
- 4 KPI (actives, terminées, en retard, inter-équipes) + 4 graphiques (charge par personne, répartition par
  statut — libellés via `STATUS_LABELS`, taux de retard, priorités).
- **Sélecteur de période** (Cette semaine / Ce mois-ci / Tout, **défaut : semaine**) : s'applique **uniquement** au
  compteur **« Terminées »**, basé sur `completed_at`. Les autres compteurs restent des instantanés.
- Points laissés ouverts : titres ne précisant pas toujours « Moi/Équipe » (jugé non prioritaire) ; redondance
  KPI « En retard » / camembert **conservée volontairement** ; vue équipe limitée au **service actif**.

### 9.8 Cartes récurrentes (`recurring_tasks`)
- Modèle **uniforme, sans carte immédiate à la création** : une carte n'est créée qu'à `lead_days` (défaut 3)
  avant l'échéance. Fréquences : chaque jour ouvré, chaque semaine, jour fixe du mois, premier/dernier jour
  ouvré du mois. `horizon_months` (NULL = infini).
- Création **dans le formulaire de carte** (bloc récurrence) + gestion depuis la carte.
- Cron quotidien `api/cron/recurring` (07:00) : crée les cartes dues (anti-doublon sur `recurring_task_id` + `deadline`).
- `lib/recurring/schedule.ts` : `isDue()` et `occurrencesInRange()` (partagé cron / calendrier).

### 9.9 Archives et Corbeille
- Archivage automatique des cartes terminées (cron `archive`). Corbeille = `deleted_at`.
- **Vues strictement personnelles** (§8.2). Restauration via `tasks/[id]/restore`.

### 9.10 Compte (`/compte`)
Menu latéral à onglets : **Profil** (photo, nom), **Notifications** (5 préférences e-mail), **Calendrier**
(fériés, vacances scolaires, « Mes congés »), **Congés** (services par défaut), **Équipe** (managers : jours d'archivage).
⚠️ Le `SELECT` de `api/account` doit inclure **toutes** les colonnes de préférences (un oubli passé faisait
afficher des bascules fausses).

### 9.11 PAC & Média Kit (Marketing et Web uniquement)
**Principe : aucune double saisie.** L'information vit **sur la carte Kanban**, le planning la lit.
- Sur les cartes des services `marketing`/`web` (`canUsePacMediaKit()` dans `types/pacMediaKit.ts`), un bloc
  optionnel **« Catégorie PAC & Média Kit »** : *Aucune / Opération commerciale / Média Kit*. Une carte **sans**
  catégorie reste strictement normale.
- **Opération commerciale** : date de début, **date de fin** (champ dédié `op_date_fin`, **distinct de
  l'échéance** de la carte), mécanique de l'opération, CGV, exclusions, commentaires.
- **Média Kit** : date de début, date de fin, montant (€), référence(s) (texte libre).
- Entrée de sidebar **« PAC & Média Kit »** visible **uniquement** si le service principal **ou additionnel** est
  Marketing ou Web.
- Page `/pac-media-kit` : calendrier mensuel (même mécanique de grille que Congés), filtre
  *Tout / Opération commerciale / Média Kit*, bouton **« Ajouter une opération »** (ouvre `NewTaskModal`
  limité aux services Marketing/Web), clic sur une pastille = ouverture de la **vraie carte** (`TaskModal`).
- **Contenu des pastilles** : Opé Com → *titre + mécanique* ; Média Kit → *titre + montant*.
- **Plage affichée** : `op_date_debut` → `op_date_fin` ; si une seule des deux dates existe, elle sert aux deux.
  (Avant l'introduction de `op_date_fin`, une carte sans échéance n'apparaissait jamais sur le planning : corrigé.)
- API : `GET /api/pac-media-kit` (**vision d'équipe complète**, exception de §8) renvoie des cartes **complètes**
  (même forme que `/api/tasks`) pour être ouvertes directement dans `TaskModal`.
- Après création, les champs spécifiques **restent affichés en permanence** sur la carte (bloc lecture seule).

---

## 10. Notifications, e-mails et tâches planifiées

### 10.1 Préférences par personne
`notify_email_assigned` (assignation), `notify_email_status` (changement de statut), `notify_email_deadlines`
(échéances/rappels), `notify_email_weekly` (récap hebdo), `notify_email_mentions` (commentaires/mentions).
`notifyByPreference({ emails, pref, subject, html })` (`lib/notify.ts`) n'envoie qu'à ceux qui ont activé la préférence.

### 10.2 Gabarits
`src/emails/baseHtml.ts` (cadre, couleurs de service, pied de page avec lien de préférences) +
`src/emails/templates.ts` (assignation, statut, commentaire, échéance, récap hebdo, absence, rappel de stagnation…).
Expéditeur : boîte `noreply@aelys.fr` (SMTP OVH). Gabarits de réinitialisation de mot de passe Supabase :
version sobre (V1) et version « fun » (V2).

### 10.3 Crons (`vercel.json`, authentifiés par `Authorization: Bearer ${CRON_SECRET}`)

| Route | Horaire | Rôle |
|---|---|---|
| `/api/cron/recurring` | chaque jour 07:00 | crée les cartes récurrentes dues dans la fenêtre `lead_days` |
| `/api/cron/deadlines` | chaque jour 08:00 | rappels d'échéance |
| `/api/cron/weekly` | lundi 08:00 | récapitulatif hebdomadaire |
| `/api/cron/archive` | chaque jour 08:05 | archivage automatique des cartes terminées |
| `/api/cron/stale` | lundi 08:30 | rappel « tâche en pause » (≥ 7 j) — envoyé aux assignés **et** à la créatrice si elle n'est pas assignée |

---

## 11. Design de la carte Kanban — leçons CSS

Ce sujet a coûté **de très nombreuses itérations**. **Ne pas retoucher sans passer par des maquettes HTML.**

### 11.1 Rendu actuel (validé par Manon, option « A »)
- Carte : `rounded-2xl`, **bordure uniforme grise** `border-2 border-border`, fond `bg-card`.
- **Barre verticale colorée de 3 px**, `rounded-full`, **positionnée à l'intérieur** de la carte
  (`absolute left-2.5 top-3.5 bottom-3.5`) — **décollée du bord**, donc ne touche jamais un coin arrondi.
- **Halo** : `box-shadow: 0 0 10px 2px {couleurService}55` posé **sur la barre elle-même**.
- Carte en retard : contour rouge par `box-shadow` (`0 0 0 1.5px #EF4444, …`) + badge « En retard »
  (`absolute -top-1.5 -right-1.5`, `z-10`).
- Contenu décalé de `pl-2` pour laisser respirer la barre.

### 11.2 Ce qui a échoué — ne pas le refaire
1. **Bordure gauche épaissie (6 px) avec d'autres côtés à 1 px** : une bordure de largeurs asymétriques ne dessine
   **pas** un vrai cercle dans les coins ; le contour rouge « en retard » (box-shadow = cercle parfait) ne peut
   jamais coïncider → décalage visible.
2. **Calque absolu `overflow-hidden` posé sur la bordure** pour « simuler » la barre : fragile (rendu
   sous-pixel différent du rendu natif), a produit une bande blanche en haut et une coupure de l'arrondi.
3. **Bordure de largeur uniforme mais avec `border-left-color` différent** : le navigateur **coupe l'arrondi en
   deux** entre les deux couleurs, au milieu de la courbe — jugé inesthétique.
4. **Glow = rectangle séparé `rounded-full`** : donnait une « pilule » mal proportionnée.
5. Glow trop faible (alpha `14` ≈ 8 %) : quasi invisible. À ne pas rendre trop fort non plus (Manon a demandé de
   l'atténuer à deux reprises sur une version antérieure).

### 11.3 Principe retenu
**Ne jamais poser d'élément coloré sur la bordure de la carte.** Tout repère coloré doit être soit entièrement
à l'intérieur, soit une propriété native unique (fond, ombre) — jamais un calque qui tente d'épouser l'arrondi.

### 11.4 Distinction « carte déléguée » — abandonnée
Plusieurs variantes (pointillés, icône œil, triangle coloré dans le coin, fonds teintés…) ont été essayées puis
**toutes retirées** à la demande de Manon : **le Kanban est « aveugle »** sur la délégation (toutes les cartes
s'affichent pareil). Le suivi se fait via le filtre « Créées par moi » et (envisagé) un e-mail hebdomadaire (§14).

---

## 12. Pièges connus et incidents passés

### 12.1 Windows / mise en ligne
- **PowerShell bloque `npm`** (« l'exécution de scripts est désactivée »). Toujours utiliser l'**Invite de commandes
  (`cmd`)**. Alternative : `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- **`findstr` et les accents** : `findstr /C:"Générer"` ne trouve rien dans `cmd` même si le texte existe
  (encodage). Vérifier avec un mot **sans accent** (nom de variable, etc.).
- `git apply` peut **échouer silencieusement** ou refuser (« patch does not apply ») si le dossier contient des
  modifications non commitées d'un ancien patch. Remède : `git checkout .` puis `git clean -fd`, vérifier
  `git status` = « working tree clean », puis recommencer.
- Des fichiers parasites (`del`, `git`, `npm`, `next`…) apparaissent quand une commande est mal collée :
  les supprimer avant `git add .`.
- Manon a parfois **déposé des `.patch` sur GitHub via l'interface web** → fichiers résiduels committés. Toujours
  vérifier `git ls-files | findstr patch`.
- Les environnements de travail se réinitialisent : après un nouveau clone, refaire `npm install` et créer un
  `.env.local` (valeurs factices suffisantes pour `next build`).

### 12.2 Données
- Une migration s'exécute **une fois** (base partagée local/prod). Vérifier le **bon projet Supabase**
  (`bgecqghthqxdyozvbrjx`) : une requête a un jour été lancée sur un **autre** projet (tables `boutiques`,
  `commandes_lignes`, `imprimeur_access`… — sans rapport avec RELAYS).
- `profiles.email` n'est **pas unique**.
- Comparer des dates : normaliser en `YYYY-MM-DD` (fuseau local), éviter `toISOString()` pour des dates calendaires.

### 12.3 Incidents majeurs
| Incident | Cause | Leçon |
|---|---|---|
| « Je vois les cartes de tout le monde » (×2) | filtre de visibilité retiré sans remplacement / règle trop large | §8 ; tester les cas de visibilité par script avant livraison |
| Retour arrière Vercel qui « ne tenait pas » | Promote ne modifie pas Git | corriger aussi dans `main` |
| Barre colorée décalée avec « En retard » | bordure asymétrique + calques | §11 |
| Patch « appliqué » mais sans effet | `git apply` échoué en silence / base locale sale | vérifier par `findstr` avant `build` |
| Toggles de profil faux | `SELECT` incomplet dans `api/account` | lister toutes les colonnes |

---

## 13. État des livraisons : en production / non poussé

### 13.1 En production (vérifié dans le code de `main`)
Visibilité stricte (créateur + assignés) · Focus du jour avec échéances de sous-tâches et cartes sans échéance
en bas par priorité · échéance dynamique sur carte · décalage en bloc des échéances · badge « En pause depuis X j »
dynamique · suppression de modèles de cartes · retours à la ligne (description + commentaires) · champ description agrandi ·
événements de calendrier · « Alternance Prénom » · périodes d'activité avec motif visible · Archives/Corbeille
personnelles · sélecteur de période des Stats · statut « À valider » (affichage) · rappel de stagnation vers la
créatrice · auto-assignation du créateur · filtre Kanban « Créées par moi » · **PAC & Média Kit complet**
(catégorie sur carte, date de fin dédiée, planning, sidebar conditionnelle, bloc lecture seule).

### 13.2 **Non** poussé / non présent dans le dépôt
- **Amélioration IA** (bouton « Améliorer avec l'IA ») — code écrit et testé, **jamais appliqué** (§14).
- **Récap hebdomadaire e-mail des tâches déléguées** (`cron/delegation-recap`) — jamais mis en ligne (§14).
- **Migrations 022 et 023** — exécutées dans Supabase mais **absentes du dépôt** (Annexe A).

### 13.3 Fichiers parasites à supprimer du dépôt
`dev-output.log` (racine) et `supabase/migrations/files.zip`. L'ancien `CLAUDE.md` est remplacé par ce document ;
vérifier aussi si `README.md` est à jour.

---

## 14. Backlog et décisions en attente

### 14.1 Fonction IA « Améliorer avec l'IA » (prête, non déployée)
Reformule titre + description à partir de notes en vrac et propose des **sous-tâches** à cocher, avec **aperçu avant
validation** (jamais d'écrasement automatique). Boutons à la **création** et à l'**édition** d'une carte.
- Contrainte de Manon : **doit rester gratuit** → **API Gemini, palier gratuit** (modèle `gemini-2.5-flash-lite`),
  clé gratuite sur `aistudio.google.com`, variable `GEMINI_API_KEY` dans Vercel.
- Point accepté explicitement : sur le palier gratuit, Google peut réutiliser les textes envoyés ; jugé acceptable
  pour des notes de tâches internes.
- Fichiers prévus : `src/lib/ai/gemini.ts`, `src/app/api/ai/improve-task/route.ts`,
  `src/components/tasks/AIImproveModal.tsx` (+ intégration dans `NewTaskModal` et `TaskModal`).
  Dans `TaskModal`, l'application crée les sous-tâches immédiatement (`POST /api/tasks/[id]/subtasks` avec `group_name`).

### 14.2 Suivi des tâches déléguées par e-mail
Besoin exprimé : **« rappel par mail des cartes attribuées et où elles en sont dans les statuts »**, avec Kanban
« aveugle ». Prévu : cron hebdomadaire (lundi ~08:45) listant, par personne, les cartes qu'elle a **créées sans y être
assignée** : assignés, **statut** (via `STATUS_LABELS`), jours sans mouvement (⚠️ à ≥ 7 j). Non mis en ligne.

### 14.3 Autres idées proposées, non décidées
- **Vue « Charge de travail par membre »** (pour ne plus passer par du SQL — Manon a fait produire à la main la
  todo de Charline en PDF à partir d'une requête). Particulièrement utile avec la visibilité stricte.
- **Vue d'ensemble pour les managers** (aujourd'hui impossible dans le Kanban à cause de la visibilité stricte).
- Focus du jour : **réserver 1–2 places** aux cartes sans échéance les jours chargés.
- Gestion des échéances : échéance suggérée pour une sous-tâche sans date ; **alerte d'incohérence**
  (sous-tâche après la carte) ; vue « échéances de la semaine » ; **rappel préventif** (« échéance dans 2 jours ») ;
  échéance avec **heure**.
- **Statistiques** : clarifier les titres Moi/Équipe ; étendre « Mon équipe » aux services additionnels des
  managers multi-services ; décider si cette vue d'équipe reste cohérente avec la visibilité stricte (§8.2).
- **Audit visuel** : centraliser les couleurs (`src/lib/colors.ts`), harmoniser largeurs de pages (`max-w-2xl` à
  `max-w-6xl`) et rayons (`rounded-xl` ×9 vs `rounded-2xl` ×4).
- Durcir la **confidentialité des sous-ressources** (`subtasks`, `comments`…) (§8.4).
- Préférence e-mail dédiée aux rappels de délégation (aujourd'hui : réutilise `notify_email_deadlines`).

---

## 15. Sécurité — actions urgentes

1. **Régénérer la clé `service_role` Supabase** : elle a été exposée dans l'historique GitHub (dépôt public).
2. **Changer le mot de passe SMTP** de la boîte `noreply@aelys.fr` : il a été collé en clair dans une conversation.
   Mettre à jour `SMTP_PASSWORD` dans Vercel.
3. Ne **jamais** committer `.env.local` ni écrire de secrets dans ce fichier ou dans les messages.
4. Rappel d'architecture : le client service role contourne la RLS → la sécurité repose sur les filtres
   applicatifs (§5 et §8). Toute nouvelle route doit appliquer la règle de visibilité **et** vérifier l'identité.

---

## Annexe A — SQL des migrations 022 et 023 (absentes du dépôt)

À versionner dans `supabase/migrations/` (déjà exécutées en base).

### `022_pac_media_kit.sql`
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_category TEXT
  CHECK (op_category IN ('operation_commerciale', 'media_kit'));

-- Date de début de l'opération
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_date_debut DATE;

-- Champs spécifiques « Opération commerciale »
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_mecanique    TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_cgv          TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_exclusions   TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_commentaires TEXT;

-- Champs spécifiques « Média Kit »
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_montant      NUMERIC;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_references   TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_op_category ON tasks(op_category) WHERE op_category IS NOT NULL;
```

### `023_pac_date_fin.sql`
```sql
-- Date de fin dédiée, distincte de "deadline" (échéance de gestion de tâche)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS op_date_fin DATE;
```

---

## Annexe B — Commandes Windows de mise en ligne

À taper dans **`cmd`** (pas PowerShell), une par une :

```bat
cd C:\Users\manon\relays
git checkout main
git pull
git status
```
Contrôle : « working tree clean ».

Après modifications (ou après application d'un patch) :
```bat
npm run build
```
Contrôle : « Compiled successfully ». Puis, pour tester en local :
```bat
rmdir /s /q .next
npm run dev
```
(`Ctrl+C` pour arrêter.) Enfin :
```bat
git add .
git commit -m "Message clair"
git push
```
Puis vérifier sur vercel.com que le dernier déploiement est **« Ready »** (vert).
Si une migration SQL est fournie : l'exécuter **d'abord** dans *Supabase → SQL Editor* (bon projet !).

---

## Annexe C — Version boutiques (ajoutée)

**Principe :** 23 boutiques (table `boutiques`, source `Coordonnées-magasins-Aelys.xlsx`). Chaque boutique a **un compte de
connexion** (profil `is_boutique_account`, service technique « Boutiques », e-mail du magasin) ; ses **collaborateurs** sont
des profils sans connexion (`boutique_id`, `is_active=false`, e-mail `@boutiques.aelys.invalid`) choisis dans le menu
« Collaborateur » de la sidebar (cookie `relays-member`). Un collaborateur peut être ajouté depuis ce menu.

- **Vues accessibles** : Kanban, PAC & Média Kit (lecture seule, sans montants), Congés & absences. Le reste est bloqué par
  `middleware.ts` (cookie `relays-boutique` posé au login).
- **Kanban** : visibilité stricte inchangée — la boutique voit les cartes créées par son compte ou assignées à son compte.
- **Congés** : la demande est posée au nom du collaborateur choisi (`lib/boutique/session.ts` → `getActingContext`).
  **Jamais d'auto-validation** (alternance comprise). Seule la RH (`profiles.can_validate_boutiques`, Chloé Estangoy) valide
  les demandes des boutiques. Une boutique ne voit que les absences de sa boutique. Les opérations commerciales (PAC) sont
  affichées sur le planning (★) et signalées à la saisie (congés déconseillés, mais demande possible).
- **Comptes** : `node scripts/create-boutique-accounts.mjs` (après la migration `024_boutiques.sql`) ; il écrit les mots de
  passe dans `Documents\relays-comptes-boutiques.csv` (hors dépôt).
- Migrations 022 et 023 sont maintenant versionnées dans `supabase/migrations/`.
- ⚠ Les routes de sous-ressources de cartes (§8.4) ne vérifient toujours pas la visibilité : à durcir.

### Annexe C bis — Verrou e-mails boutiques et routines liées
- **Verrou** : `lib/email.ts` (`removeBoutiqueRecipients`) retire TOUT destinataire boutique (comptes, collaborateurs,
  adresses des magasins) tant que la variable Vercel `BOUTIQUES_EMAILS_ENABLED` n'est pas `true`. À passer à `true`
  le jour du lancement de l'outil aux magasins. Ne couvre pas les e-mails d'authentification Supabase (mot de passe oublié).
- **Routines** : `notify/absence-request` (demande → RH validatrice ; alternance saisie → information RH ; Audrey reçoit
  ceux de ses 3 services), `notify/absence-review` (décision → boutique, bloqué par le verrou), `cron/leave-reminder`
  (jours ouvrés 08:15 : récap des demandes en attente à la RH), invitations d'événements (`lib/calendar/notifyAttendees.ts`).
- Migration 025 : `task_subtasks.parent_subtask_id` (sous-sous-tâches) et `calendar_event_attendees` (invités).

### Annexe C ter — Règles de congés des boutiques (migration 026)
- `lib/absences/leaveRules.ts` (logique pure, testée) : refus d'office des congés payés sur — semaine de la Saint-Valentin,
  semaine de la fête des mères, 1re semaine des soldes (hiver/été, dates calculées selon la loi), du Black Friday jusqu'à la
  fin de la 1re semaine des soldes de janvier (Noël compris), semaines saisies par la RH (`leave_blocked_periods`, onglet
  « Périodes sans congés » de `/conges/rh`), et semaine où un·e apprenti·e (`profiles.contract_type` ilike `apprenti%`) a plus de 3 jours
  ouvrés d'« Alternance ». Contrôle serveur dans `POST /api/absences` et `PUT /api/absences/[id]` (422), alerte en direct via
  `GET /api/absences/rules`. Les opérations commerciales restent un simple avertissement.
- Refus d'une demande de boutique : motif obligatoire (`REFUSAL_REASONS` + « Autre » avec commentaire), stocké dans `absences.review_note`,
  visible dans « Mes demandes » et dans l'e-mail de décision.
- Import des collaborateurs : `node scripts/import-boutique-members.mjs <json> [--dry-run]` ; `leave_balance_conges` = « reste à poser »,
  `leave_balance_since` = date d'import (seuls les congés validés depuis cette date sont déduits).

### Annexe C quater — Acquisition des congés, périodes par magasin, bouton RH (migration 027)
- **Jours acquis vs en cours d'acquisition** : `profiles.leave_balance_conges` = jours acquis à poser (négatif = pris par anticipation, affiché
  en rouge) ; `profiles.leave_acquiring` = en cours d'acquisition. Cron `api/cron/leave-accrual` (1er du mois, 03:00 UTC) : +2,08 j
  (plafond 25) ; le **1er juin** : bascule — acquis += acquisition (25 pour une année pleine), acquisition remise à 0, nouvelle période
  (`leave_balance_since` = 1er juin, `leave_taken_period` = 0). Garde-fou anti double exécution : table `leave_accrual_runs`.
- **Plafond de 5 semaines** : 25 jours ouvrés de congés payés par période du 1er juin au 31 mai (pris avant RELAYS =
  `leave_taken_period`, + demandes RELAYS non refusées + demande en cours) — `leaveRulesServer.ts`.
- **Périodes interdites par magasin** : `leave_blocked_periods.boutique_id` (NULL = toutes les boutiques).
- La demande de CP affiche les jours ouvrés demandés et le solde après demande (rouge si négatif, possible en anticipé).
- **Bouton RH** « Gestion des congés boutiques » (dégradé, bas de sidebar) + pastille rouge `api/rh/pending-count`.
  Le service technique « Boutiques » n'apparaît plus dans les services de la RH validatrice.
