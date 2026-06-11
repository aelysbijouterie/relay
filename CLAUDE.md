# CLAUDE.md — Projet RELAYS
> Instructions permanentes pour Claude Code. Ce fichier est lu automatiquement à chaque session.

---

## 📋 PROJET

**Nom :** RELAYS  
**Type :** Application web de gestion de tâches  
**Secteur :** Vente & distribution de bijoux (~20 collaborateurs, 6 départements)

### Stack technique
- **Frontend :** Next.js 14+ (App Router) + TypeScript strict
- **UI :** Tailwind CSS + shadcn/ui
- **Drag & drop :** @dnd-kit/sortable
- **Backend / DB :** Supabase (PostgreSQL + Auth + RLS + Realtime)
- **Auth :** Supabase Auth (email/password + invitation)
- **State :** Zustand (useTaskStore)
- **Validation :** Zod + react-hook-form
- **Déploiement :** Vercel

### Départements & couleurs
```
Marketing    → #FF6B35  (slug: marketing)
Web          → #4A90D9  (slug: web)
Comptabilité → #F5C518  (slug: comptabilite)
RH           → #9B59B6  (slug: rh)
Logistique   → #27AE60  (slug: logistique)
Direction    → #E74C3C  (slug: direction)
```

---

## 🏗️ STRUCTURE DU PROJET

```
relays/
├── src/
│   ├── app/
│   │   ├── (auth)/login/         ← page de connexion
│   │   ├── (dashboard)/          ← layout + pages protégées
│   │   │   ├── kanban/
│   │   │   ├── timeline/
│   │   │   ├── calendrier/
│   │   │   └── stats/
│   │   └── auth/callback/        ← OAuth/invitation callback
│   ├── components/
│   │   ├── kanban/               ← KanbanBoard, KanbanColumn, KanbanBoardServer
│   │   ├── tasks/                ← TaskCard, TaskModal, NewTaskModal
│   │   ├── layout/               ← Sidebar, Header
│   │   ├── timeline/             ← TimelineView
│   │   ├── calendar/             ← CalendarView
│   │   └── stats/                ← StatsView
│   ├── lib/
│   │   ├── supabase/             ← client.ts, server.ts
│   │   ├── actions/              ← tasks.ts, auth.ts, departments.ts
│   │   ├── validations/          ← task.ts (Zod schemas)
│   │   └── utils.ts
│   ├── store/tasks.ts            ← Zustand store
│   ├── hooks/useRealtimeTasks.ts
│   └── types/index.ts
├── supabase/
│   ├── migrations/001_initial.sql
│   └── seed.sql
└── middleware.ts                  ← protection des routes
```

---

## ✅ RÈGLES DE DÉVELOPPEMENT

### Code
- TypeScript strict — pas de `any`
- Composants fonctionnels React uniquement
- Server Components par défaut, `"use client"` seulement si nécessaire
- Nommage : `PascalCase` composants, `camelCase` fonctions, `kebab-case` fichiers

### UI & Design
- Utiliser les couleurs de département comme tokens CSS (`--dept-marketing`, etc.)
- Interface **en français**
- Mobile-first, responsive obligatoire
- Dark mode supporté (next-themes)
- Typo : Playfair Display (titres) + DM Sans (corps)

### Sécurité
- RLS Supabase activé sur toutes les tables
- Jamais de logique d'accès côté client uniquement
- Validation des inputs côté serveur (Zod)
- Pas de secrets dans le code — utiliser `.env.local`

---

## 🚫 INTERDICTIONS

- Ne jamais bypasser les RLS policies Supabase
- Ne jamais exposer les données d'un département à un autre
- Ne pas utiliser `Inter`, `Roboto` ou `Arial` comme police principale
- Ne pas hardcoder les couleurs — utiliser les CSS variables
- Pas de `select('*')` sur les tables — toujours lister les colonnes
