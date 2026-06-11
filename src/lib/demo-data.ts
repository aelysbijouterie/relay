import type { Task, Department, Profile } from '@/types'

// ── Départements ──────────────────────────────────────────────────────────────
export const DEMO_DEPARTMENTS: Department[] = [
  { id: 'dept-marketing',  name: 'Marketing',     color: '#ECEFBD', icon: '📣', slug: 'marketing' },
  { id: 'dept-web',        name: 'Web',           color: '#EB5C82', icon: '💻', slug: 'web' },
  { id: 'dept-compta',     name: 'Administratif', color: '#54673C', icon: '📊', slug: 'administratif' },
  { id: 'dept-rh',         name: 'RH',            color: '#C9E1F8', icon: '👥', slug: 'rh' },
  { id: 'dept-logistique', name: 'Logistique',    color: '#FAFFAD', icon: '📦', slug: 'logistique' },
  { id: 'dept-direction',  name: 'Direction',     color: '#0A2342', icon: '🏛️', slug: 'direction' },
]

const [mkt, web, admin, rh, log, dir] = DEMO_DEPARTMENTS

// ── Membres ───────────────────────────────────────────────────────────────────
const mkMember = (id: string, name: string, email: string, role: Profile['role'], deptId: string): Profile => ({
  id, name, email, role, department_id: deptId, avatar_url: null, is_active: true, created_at: '',
})

export const ALL_DEMO_MEMBERS: Profile[] = [
  // Marketing
  mkMember('u-mkt-1', 'Manon Mignot',    'manon.mignot@aelys.fr',    'manager',       'dept-marketing'),
  mkMember('u-mkt-2', 'Charline Ballarin','marketing.aelys@aelys.fr', 'collaborateur', 'dept-marketing'),
  // Web
  mkMember('u-web-1', 'Wendy Vignes',     'wendy.vignes@aelys.fr',    'manager',       'dept-web'),
  mkMember('u-web-2', 'Maylis Andrieu',   'web@aelys.fr',             'collaborateur', 'dept-web'),
  // Administratif
  mkMember('u-adm-1', 'Audrey Arees',     'audrey.arees@aelys.fr',    'manager',       'dept-compta'),
  mkMember('u-adm-2', 'Sarah Turon',      'bureau-occitania@aelys.fr','collaborateur', 'dept-compta'),
  // RH — Audrey est aussi responsable RH
  mkMember('u-rh-1',  'Audrey Arees',     'audrey.arees@aelys.fr',    'manager',       'dept-rh'),
  mkMember('u-rh-2',  'Chloé Estangoy',   'chloe.estangoy@aelys.fr',  'collaborateur', 'dept-rh'),
  // Logistique
  mkMember('u-log-1', 'Ludwig Barrachin', 'ludwig.barrachin@aelys.fr','manager',       'dept-logistique'),
  mkMember('u-log-2', 'Nassima Chayek',   'office-cabi@aelys.fr',     'collaborateur', 'dept-logistique'),
  mkMember('u-log-3', 'Sophie Guilcher',  'stock-occitania@aelys.fr', 'collaborateur', 'dept-logistique'),
  mkMember('u-log-4', 'Emeric Gardelle',  'stock-occitania@aelys.fr', 'collaborateur', 'dept-logistique'),
  // Direction (placeholders)
  mkMember('u-dir-1', 'Direction',        'direction@aelys.fr',       'admin',         'dept-direction'),
]

// Membres par département (lookup rapide)
export const MEMBERS_BY_DEPT: Record<string, Profile[]> = {}
ALL_DEMO_MEMBERS.forEach(m => {
  if (m.department_id) {
    if (!MEMBERS_BY_DEPT[m.department_id]) MEMBERS_BY_DEPT[m.department_id] = []
    MEMBERS_BY_DEPT[m.department_id].push(m)
  }
})

// Rétro-compat
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

// ── Raccourcis membres ────────────────────────────────────────────────────────
const m1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-mkt-1')!
const m2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-mkt-2')!
const w1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-web-1')!
const w2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-web-2')!
const a1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-adm-1')!
const a2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-adm-2')!
const r1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-rh-1')!
const r2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-rh-2')!
const l1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-log-1')!
const l2 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-log-2')!
const l3 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-log-3')!
const l4 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-log-4')!
const d1 = ALL_DEMO_MEMBERS.find(m => m.id === 'u-dir-1')!

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

// Tâches Marketing
const TASKS_MARKETING: Task[] = [
  mk('m1', { title: 'Shooting photo collection été', status: 'En cours', priority: 'Urgent', deadline: '2026-06-18', fournisseur_client: 'Studio Lumière', ref_collection: 'ETE-2026', assignees: [m1, m2], description: 'Organiser le shooting pour la collection ETE-2026.' }),
  mk('m2', { title: 'Newsletter juin — nouveautés', status: 'A Faire', priority: 'Élevée', deadline: '2026-06-22', assignees: [m2] }),
  mk('m3', { title: 'Mise à jour visuels Instagram', status: 'A Faire', priority: 'Moyenne', deadline: '2026-06-28', ref_collection: 'SPRING-2026', assignees: [m2] }),
  mk('m4', { title: 'Brief agence presse — automne', status: 'A revoir', priority: 'Élevée', deadline: '2026-07-05', fournisseur_client: 'Agence Prestige PR', ref_collection: 'AUT-2026', assignees: [m1] }),
  mk('m5', { title: 'Rapport performances campagnes T2', status: 'Terminé', priority: 'Moyenne', deadline: '2026-06-10', assignees: [m1, m2] }),
  mk('m6', { title: 'Campagne Google Ads juillet', status: 'Bloqué', priority: 'Élevée', deadline: '2026-06-30', assignees: [m2] }),
  mk('x1', { title: 'Lancement collection printemps — page produit', status: 'En cours', priority: 'Urgent', deadline: '2026-06-20', department_id: 'dept-web', department: web, is_cross_team: true, ref_collection: 'SPRING-2026', assignees: [m1, w1], extra_departments: [mkt] }),
  mk('x2', { title: 'Coordination livraison boutiques', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-10', department_id: 'dept-logistique', department: log, is_cross_team: true, assignees: [m1, l1], extra_departments: [mkt] }),
]

// Tâches Web
const TASKS_WEB: Task[] = [
  { ...mk('w1', { title: 'Refonte page accueil', status: 'En cours', priority: 'Urgent', deadline: '2026-06-25', assignees: [w1, w2] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w2', { title: 'Intégration configurateur bijoux', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-01', assignees: [w2], ref_collection: 'SPRING-2026' }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w3', { title: 'Optimisation SEO pages produits', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-15', assignees: [w1] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w4', { title: 'Correction bug panier mobile', status: 'Bloqué', priority: 'Urgent', deadline: '2026-06-15', assignees: [w2] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  { ...mk('w5', { title: 'Migration vers Vercel', status: 'Terminé', priority: 'Élevée', assignees: [w1] }), department_id: 'dept-web', department: web, created_by: 'u-web-1' },
  mk('x1', { title: 'Lancement collection printemps — page produit', status: 'En cours', priority: 'Urgent', deadline: '2026-06-20', department_id: 'dept-web', department: web, is_cross_team: true, ref_collection: 'SPRING-2026', assignees: [m1, w1], extra_departments: [mkt] }),
]

// Tâches Administratif
const TASKS_ADMIN: Task[] = [
  { ...mk('a1', { title: 'Clôture comptable juin', status: 'En cours', priority: 'Urgent', deadline: '2026-06-30', assignees: [a1] }), department_id: 'dept-compta', department: admin, created_by: 'u-adm-1' },
  { ...mk('a2', { title: 'Déclaration TVA T2', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-20', assignees: [a1] }), department_id: 'dept-compta', department: admin, created_by: 'u-adm-1' },
  { ...mk('a3', { title: 'Rapprochement bancaire mai', status: 'Terminé', priority: 'Moyenne', assignees: [a2] }), department_id: 'dept-compta', department: admin, created_by: 'u-adm-1' },
  { ...mk('a4', { title: 'Bilan fournisseurs collection été', status: 'A revoir', priority: 'Élevée', deadline: '2026-07-05', assignees: [a1], fournisseur_client: 'Multi-fournisseurs' }), department_id: 'dept-compta', department: admin, created_by: 'u-adm-1' },
  { ...mk('ax1', { title: 'Budget campagne marketing T3', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-01', is_cross_team: true, assignees: [a1, m1], extra_departments: [mkt], department_id: 'dept-compta', department: admin }), created_by: 'u-adm-1' },
]

// Tâches RH
const TASKS_RH: Task[] = [
  { ...mk('r1', { title: 'Entretiens annuels — équipe Web', status: 'En cours', priority: 'Élevée', deadline: '2026-06-30', assignees: [r1] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r2', { title: 'Onboarding nouveau stagiaire Marketing', status: 'A Faire', priority: 'Moyenne', deadline: '2026-06-17', assignees: [r1], is_cross_team: true, extra_departments: [mkt] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r3', { title: 'Mise à jour contrats prestataires', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-10', assignees: [r2] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r4', { title: 'Bilan formation équipe Logistique', status: 'Terminé', priority: 'Faible', assignees: [r1] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
  { ...mk('r5', { title: 'Planification congés été 2026', status: 'A Faire', priority: 'Moyenne', deadline: '2026-06-25', assignees: [r1, r2] }), department_id: 'dept-rh', department: rh, created_by: 'u-rh-1' },
]

// Tâches Logistique
const TASKS_LOGISTIQUE: Task[] = [
  { ...mk('l1', { title: 'Réception commande fournisseur Italie', status: 'En cours', priority: 'Urgent', deadline: '2026-06-19', assignees: [l1, l2], fournisseur_client: 'Orafi Milano' }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l2', { title: 'Inventaire stock bijoux collection été', status: 'A Faire', priority: 'Élevée', deadline: '2026-06-25', assignees: [l3, l4], ref_collection: 'ETE-2026' }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l3', { title: 'Expédition commandes boutiques Paris', status: 'A revoir', priority: 'Élevée', deadline: '2026-06-21', assignees: [l1] }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l4', { title: 'Audit entrepôt — conformité', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-15', assignees: [l1, l2] }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  { ...mk('l5', { title: 'Mise à jour tableau de bord stock', status: 'Terminé', priority: 'Faible', assignees: [l3, l4] }), department_id: 'dept-logistique', department: log, created_by: 'u-log-1' },
  mk('x2', { title: 'Coordination livraison boutiques', status: 'A Faire', priority: 'Moyenne', deadline: '2026-07-10', department_id: 'dept-logistique', department: log, is_cross_team: true, assignees: [m1, l1], extra_departments: [mkt] }),
]

// Tâches Direction
const TASKS_DIRECTION: Task[] = [
  { ...mk('d1', { title: 'Réunion stratégie H2 2026', status: 'A Faire', priority: 'Urgent', deadline: '2026-06-20', assignees: [d1] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-1' },
  { ...mk('d2', { title: 'Revue budget annuel', status: 'En cours', priority: 'Élevée', deadline: '2026-06-30', assignees: [d1] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-1' },
  { ...mk('d3', { title: 'Présentation résultats T2 — conseil', status: 'A revoir', priority: 'Urgent', deadline: '2026-07-05', assignees: [d1] }), department_id: 'dept-direction', department: dir, created_by: 'u-dir-1' },
  { ...mk('dx1', { title: 'Validation budget campagne automne', status: 'A Faire', priority: 'Élevée', deadline: '2026-07-10', is_cross_team: true, assignees: [d1, m1, a1], extra_departments: [mkt, admin], department_id: 'dept-direction', department: dir }), created_by: 'u-dir-1' },
]

// ── Index par département ─────────────────────────────────────────────────────
export const TASKS_BY_DEPT: Record<string, Task[]> = {
  'dept-marketing':  TASKS_MARKETING,
  'dept-web':        TASKS_WEB,
  'dept-compta':     TASKS_ADMIN,
  'dept-rh':         TASKS_RH,
  'dept-logistique': TASKS_LOGISTIQUE,
  'dept-direction':  TASKS_DIRECTION,
}

// Rétro-compat
export const DEMO_TASKS = TASKS_MARKETING

export const ALL_DEMO_TASKS: Task[] = Object.values(TASKS_BY_DEPT)
  .flat()
  .filter((task, i, arr) => arr.findIndex(t => t.id === task.id) === i)

export function getTasksForDept(deptId: string): Task[] {
  return ALL_DEMO_TASKS.filter(task =>
    task.department_id === deptId ||
    (task.is_cross_team && (task.extra_departments ?? []).some(d => d.id === deptId))
  )
}
