import type { Task, Department, Profile } from '@/types'

// ── Départements ──────────────────────────────────────────────────────────────
export const DEMO_DEPARTMENTS: Department[] = [
  { id: 'dept-marketing',  name: 'Marketing',    color: '#FF6B35', icon: '📣', slug: 'marketing' },
  { id: 'dept-web',        name: 'Web',          color: '#4A90D9', icon: '💻', slug: 'web' },
  { id: 'dept-compta',     name: 'Comptabilité', color: '#F5C518', icon: '📊', slug: 'comptabilite' },
  { id: 'dept-rh',         name: 'RH',           color: '#9B59B6', icon: '👥', slug: 'rh' },
  { id: 'dept-logistique', name: 'Logistique',   color: '#27AE60', icon: '📦', slug: 'logistique' },
  { id: 'dept-direction',  name: 'Direction',    color: '#E74C3C', icon: '🏛️', slug: 'direction' },
]

const [mkt, web, compta, rh, log, dir] = DEMO_DEPARTMENTS

// ── Membres par département ────────────────────────────────────────────────────
const mkMember = (id: string, name: string, email: string, role: Profile['role'], deptId: string): Profile => ({
  id, name, email, role, department_id: deptId, avatar_url: null, is_active: true, created_at: '',
})

export const ALL_DEMO_MEMBERS: Profile[] = [
  // Marketing
  mkMember('u-mkt-1', 'Manon M.',    'manon@aelys.fr',    'manager',       'dept-marketing'),
  mkMember('u-mkt-2', 'Lucas D.',    'lucas@aelys.fr',    'collaborateur', 'dept-marketing'),
  mkMember('u-mkt-3', 'Chloé R.',    'chloe@aelys.fr',    'collaborateur', 'dept-marketing'),
  // Web
  mkMember('u-web-1', 'Thomas V.',   'thomas@aelys.fr',   'manager',       'dept-web'),
  mkMember('u-web-2', 'Sara L.',     'sara@aelys.fr',     'collaborateur', 'dept-web'),
  mkMember('u-web-3', 'Kévin B.',    'kevin@aelys.fr',    'collaborateur', 'dept-web'),
  // Comptabilité
  mkMember('u-cpt-1', 'Isabelle F.', 'isabelle@aelys.fr', 'manager',       'dept-compta'),
  mkMember('u-cpt-2', 'Rémi G.',     'remi@aelys.fr',     'collaborateur', 'dept-compta'),
  // RH
  mkMember('u-rh-1',  'Julie N.',    'julie@aelys.fr',    'manager',       'dept-rh'),
  mkMember('u-rh-2',  'Pierre C.',   'pierre@aelys.fr',   'collaborateur', 'dept-rh'),
  // Logistique
  mkMember('u-log-1', 'Marc T.',     'marc@aelys.fr',     'manager',       'dept-logistique'),
  mkMember('u-log-2', 'Amina K.',    'amina@aelys.fr',    'collaborateur', 'dept-logistique'),
  mkMember('u-log-3', 'David S.',    'david@aelys.fr',    'collaborateur', 'dept-logistique'),
  // Direction
  mkMember('u-dir-1', 'Sophie A.',   'sophie@aelys.fr',   'admin',         'dept-direction'),
  mkMember('u-dir-2', 'Antoine R.',  'antoine@aelys.fr',  'manager',       'dept-direction'),
]

// Membres par département (lookup rapide)
export const MEMBERS_BY_DEPT: Record<string, Profile[]> = {}
ALL_DEMO_MEMBERS.forEach(m => {
  if (m.department_id) {
    if (!MEMBERS_BY_DEPT[m.department_id]) MEMBERS_BY_DEPT[m.department_id] = []
    MEMBERS_BY_DEPT[m.department_id].push(m)
  }
})

// Rétro-compat : DEMO_MEMBERS = membres marketing
export const DEMO_MEMBERS = MEMBERS_BY_DEPT['dept-marketing']

// ── Profils démo par département ─────────────────────────────────────────────
export const DEMO_PROFILES: Record<string, { profile: Profile; department: Department; members: Profile[] }> = {}
DEMO_DEPARTMENTS.forEach(dept => {
  const members = MEMBERS_BY_DEPT[dept.id] ?? []
  const manager = members.find(m => m.role === 'manager' || m.role === 'admin') ?? members[0]
  if (manager) {
    DEMO_PROFILES[dept.slug] = {
      profile: { ...manager, department: dept },
      department: dept,
      members,
    }
  }
})

// ── Tâches démo ───────────────────────────────────────────────────────────────
const mk = (id: string, t: Partial<Task> & { title: string; status: Task['status']; priority: Task['priority'] }): Task => ({
  id,
  description: null,
  department_id: 'dept-marketing',
  created_by: 'u-mkt-1',
  deadline: null,
  is_cross_team: false,
  fournisseur_client: null,
  ref_collection: null,
  parent_task_id: null,
  created_at: '',
  updated_at: '',
  department: mkt,
  assignees: [],
  extra_departments: [],
  ...t,
})

const m1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-mkt-1')!
const m2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-mkt-2')!
const m3 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-mkt-3')!
const w1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-web-1')!
const w2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-web-2')!
const l1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-log-1')!
const l2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-log-2')!
const c1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-cpt-1')!
const r1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-rh-1')!
const d1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-dir-1')!

// Tâches Marketing
const TASKS_MARKETING: Task[] = [
  mk('m1', { title: 'Shooting photo collection été', status: 'En cours', priority: 'Urgent', deadline: '2026-06-18', fournisseur_client: 'Studio Lumière', ref_collection: 'ETE-2026', assignees: [m1, m2], description: 'Organiser le shooting avec Studio Lumière pour la collection ETE-2026.' }),
  mk('m2', { title: 'Newsletter juin — nouveautés', status: 'A Faire', priority: 'Élevée', deadline: '2026-06-22', assignees: [m3] }),
  mk('m3', { title: 'Mise à jour visuels Instagram', status: 'A Faire', priority: 'Moyenne', deadline: '2026-06-28', ref_collection: 'SPRING-2026', assignees: [m2] }),
  mk('m4', { title: 'Brief agence presse — automne', status: 'A revoir', priority: 'Élevée', deadline: '2026-07-05', fournisseur_client: 'Agence Prestige PR', ref_collection: 'AUT-2026', assignees: [m1] }),
  mk('m5', { title: 'Rapport performances campagnes T2', status: 'Terminé', priority: 'Moyenne', deadline: '2026-06-10', assignees: [m1, m3] }),
  mk('m6', { title: 'Campagne Google Ads juillet', status: 'Bloqué', priority: 'Élevée', deadline: '2026-06-30', assignees: [m2] }),
  // Inter-équipes (Marketing impliqué)
  mk('x1', { title: 'Lancement collection printemps — page produit', status: 'En cours', priority: 'Urgent', deadline: '2026-06-20', department_id: 'dept-web', department: web, is_cross_team: true, fournisseur_client: 'Atelier Dorée', ref_collection: 'SPRING-2026', assignees: [m1, w1], extra_departments: [mkt] }),
  mk('x2', { title: 'Coordination livraison — boutiques', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-10', department_id: 'dept-logistique', department: log, is_cross_team: true, assignees: [m3, l1], extra_departments: [mkt] }),
]

// Tâches Web
const TASKS_WEB: Task[] = [
  { ...mk('w1', { title: 'Refonte page accueil', status: 'En cours', priority: 'Urgent', deadline: '2026-06-25', assignees: [w1, w2] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w2', { title: 'Intégration nouveau configurateur bijoux', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-01', assignees: [w2], ref_collection: 'SPRING-2026' }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w3', { title: 'Optimisation SEO pages produits', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-15', assignees: [w1] }), department_id: 'dept-web', department: web, created_by: 'u-web-2' },
  { ...mk('w4', { title: 'Correction bug panier mobile', status: 'Bloqué', priority: 'Urgent', deadline: '2026-06-15', assignees: [w2] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w5', { title: 'Migration serveur vers Vercel', status: 'Terminé', priority: 'Élevée', assignees: [w1] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  mk('x1', { title: 'Lancement collection printemps — page produit', status: 'En cours', priority: 'Urgent', deadline: '2026-06-20', department_id: 'dept-web', department: web, is_cross_team: true, fournisseur_client: 'Atelier Dorée', ref_collection: 'SPRING-2026', assignees: [m1, w1], extra_departments: [mkt] }),
]

// Tâches Comptabilité
const TASKS_COMPTA: Task[] = [
  { ...mk('c1', { title: 'Clôture comptable juin', status: 'En cours', priority: 'Urgent', deadline: '2026-06-30', assignees: [c1] }), department_id: 'dept-compta', department: compta, created_by: 'u-cpt-1' },
  { ...mk('c2', { title: 'Déclaration TVA T2', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-20', assignees: [c1] }), department_id: 'dept-compta', department: compta, created_by: 'u-cpt-1' },
  { ...mk('c3', { title: 'Rapprochement bancaire mai', status: 'Terminé', priority: 'Moyenne', assignees: [ALL_DEMO_MEMBERS.find(m=>m.id==='u-cpt-2')!] }), department_id: 'dept-compta', department: compta, created_by: 'u-cpt-1' },
  { ...mk('c4', { title: 'Bilan fournisseurs collection été', status: 'A revoir', priority: 'Élevée', deadline: '2026-07-05', assignees: [c1], fournisseur_client: 'Multi-fournisseurs' }), department_id: 'dept-compta', department: compta, created_by: 'u-cpt-1' },
  { ...mk('cx1', { title: 'Budget campagne marketing T3', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-01', is_cross_team: true, assignees: [c1, m1], extra_departments: [compta], department_id: 'dept-compta', department: compta }), created_by: 'u-cpt-1' },
]

// Tâches RH
const TASKS_RH: Task[] = [
  { ...mk('r1', { title: 'Entretiens annuels — équipe Web', status: 'En cours', priority: 'Élevée', deadline: '2026-06-30', assignees: [r1] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r2', { title: 'Onboarding nouveau stagiaire Marketing', status: 'A Faire', priority: 'Moyenne', deadline: '2026-06-17', assignees: [r1], is_cross_team: true, extra_departments: [mkt] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r3', { title: 'Mise à jour contrats prestataires', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-10', assignees: [ALL_DEMO_MEMBERS.find(m=>m.id==='u-rh-2')!] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r4', { title: 'Bilan formation équipe Logistique', status: 'Terminé', priority: 'Faible', assignees: [r1] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
]

// Tâches Logistique
const TASKS_LOGISTIQUE: Task[] = [
  { ...mk('l1', { title: 'Réception commande fournisseur Italie', status: 'En cours', priority: 'Urgent', deadline: '2026-06-19', assignees: [l1, l2], fournisseur_client: 'Orafi Milano' }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l2', { title: 'Inventaire stock bijoux collection été', status: 'A Faire', priority: 'Élevée', deadline: '2026-06-25', assignees: [l2], ref_collection: 'ETE-2026' }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l3', { title: 'Expédition commandes boutiques Paris', status: 'A revoir', priority: 'Élevée', deadline: '2026-06-21', assignees: [l1] }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l4', { title: 'Audit entrepôt — conformité', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-15', assignees: [l1] }), department_id: 'dept-logistique', department: log, created_by: 'u-log-2' },
  { ...mk('l5', { title: 'Mise à jour tableau de bord stock', status: 'Terminé', priority: 'Faible', assignees: [l2] }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  mk('x2', { title: 'Coordination livraison — boutiques', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-10', department_id: 'dept-logistique', department: log, is_cross_team: true, assignees: [m3, l1], extra_departments: [mkt] }),
]

// Tâches Direction
const TASKS_DIRECTION: Task[] = [
  { ...mk('d1', { title: 'Réunion stratégie H2 2026', status: 'A Faire', priority: 'Urgent', deadline: '2026-06-20', assignees: [d1, ALL_DEMO_MEMBERS.find(m=>m.id==='u-dir-2')!] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-1' },
  { ...mk('d2', { title: 'Revue budget annuel', status: 'En cours', priority: 'Élevée', deadline: '2026-06-30', assignees: [d1] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-1' },
  { ...mk('d3', { title: 'Présentation résultats T2 — conseil', status: 'A revoir', priority: 'Urgent', deadline: '2026-07-05', assignees: [d1] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-1' },
  { ...mk('d4', { title: 'Plan développement international', status: 'A Faire', priority: 'Élevée', deadline: '2026-09-01', assignees: [ALL_DEMO_MEMBERS.find(m=>m.id==='u-dir-2')!] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-2' },
  { ...mk('dx1', { title: 'Validation budget campagne automne', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-10', is_cross_team: true, assignees: [d1, m1, c1], extra_departments: [mkt, compta], department_id: 'dept-direction', department: dir }), created_by: 'u-dir-1' },
]

// Tâches par département
export const TASKS_BY_DEPT: Record<string, Task[]> = {
  'dept-marketing':  TASKS_MARKETING,
  'dept-web':        TASKS_WEB,
  'dept-compta':     TASKS_COMPTA,
  'dept-rh':         TASKS_RH,
  'dept-logistique': TASKS_LOGISTIQUE,
  'dept-direction':  TASKS_DIRECTION,
}

// Rétro-compat
export const DEMO_TASKS = TASKS_MARKETING

// Toutes les tâches démo (toutes depts confondus, dédupliquées par id)
export const ALL_DEMO_TASKS: Task[] = Object.values(TASKS_BY_DEPT)
  .flat()
  .filter((task, i, arr) => arr.findIndex(t => t.id === task.id) === i)

/**
 * Retourne toutes les tâches visibles pour un département :
 * - les tâches dont le department_id principal = deptId
 * - les tâches inter-équipes qui l'incluent dans extra_departments
 */
export function getTasksForDept(deptId: string): Task[] {
  return ALL_DEMO_TASKS.filter(task =>
    task.department_id === deptId ||
    (task.is_cross_team && (task.extra_departments ?? []).some(d => d.id === deptId))
  )
}
