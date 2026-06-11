# RELAYS — Application de gestion de tâches

Application web de gestion de tâches pour une entreprise de vente et distribution de bijoux (~20 collaborateurs, 6 départements).

## Stack

- **Next.js 14** (App Router) + TypeScript strict
- **Supabase** (PostgreSQL + Auth + RLS + Realtime)
- **Tailwind CSS** + shadcn/ui
- **@dnd-kit** pour le drag & drop Kanban
- **Zustand** pour le state client
- **Vercel** pour le déploiement

---

## Démarrage rapide

### 1. Cloner et installer

```bash
cd relays
npm install
```

### 2. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor** et exécuter dans l'ordre :
   - `supabase/migrations/001_initial.sql`
   - `supabase/seed.sql`

### 3. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplir `.env.local` avec vos clés Supabase :
- `NEXT_PUBLIC_SUPABASE_URL` → Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Settings > API > anon key
- `SUPABASE_SERVICE_ROLE_KEY` → Settings > API > service_role key
- `NEXT_PUBLIC_APP_URL` → `http://localhost:3000` en dev

### 4. Lancer en développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Créer le premier utilisateur admin

Dans le dashboard Supabase > **Authentication > Users > Invite user**, puis dans **SQL Editor** :

```sql
UPDATE profiles
SET role = 'admin', department_id = (SELECT id FROM departments WHERE slug = 'direction')
WHERE email = 'votre@email.com';
```

---

## Déploiement Vercel

```bash
npx vercel
```

Ajouter les variables d'environnement dans le dashboard Vercel (Settings > Environment Variables).

Dans Supabase > Authentication > URL Configuration, ajouter :
- **Site URL** : `https://votre-app.vercel.app`
- **Redirect URLs** : `https://votre-app.vercel.app/auth/callback`

---

## Structure des rôles

| Rôle | Accès |
|------|-------|
| `collaborateur` | Tâches de son département + inter-équipes + tâches assignées |
| `manager` | Toutes les tâches du département + stats + invitation |
| `admin` | Tout (Direction) |

---

## Inviter un collaborateur

Via l'interface (à venir) ou en utilisant l'action serveur `inviteUser()` :

```typescript
await inviteUser('nouveau@aelys.fr', departmentId, 'collaborateur')
```

Un email d'invitation Supabase est envoyé automatiquement.

---

## Realtime

Les tâches se mettent à jour en temps réel via Supabase Realtime.  
Activer Realtime sur les tables dans Supabase > **Database > Replication** :
- `tasks`
- `task_departments`
