export type OpCategory = 'operation_commerciale' | 'media_kit'

export const OP_CATEGORY_LABELS: Record<OpCategory, string> = {
  operation_commerciale: 'Opération commerciale',
  media_kit: 'Média Kit',
}

export const OP_CATEGORY_COLORS: Record<OpCategory, string> = {
  operation_commerciale: '#E0596A', // couleur Marketing
  media_kit: '#3B82F6',             // bleu, distinct
}

// Services autorisés à utiliser PAC & Média Kit.
export const PAC_MEDIA_KIT_DEPARTMENTS = ['marketing', 'web']

export function canUsePacMediaKit(departmentSlug?: string | null, extraSlugs: string[] = []): boolean {
  return PAC_MEDIA_KIT_DEPARTMENTS.includes(departmentSlug ?? '')
    || extraSlugs.some(s => PAC_MEDIA_KIT_DEPARTMENTS.includes(s))
}

// Une carte classée pour le planning PAC & Média Kit — champs communs +
// spécifiques, tels que renvoyés par /api/pac-media-kit.
export interface PacMediaKitTask {
  id: string
  title: string
  op_category: OpCategory
  op_date_debut: string | null   // date de début
  op_date_fin: string | null     // date de fin, DISTINCTE de l'échéance de la carte
  op_mecanique: string | null
  op_cgv: string | null
  op_exclusions: string | null
  op_commentaires: string | null
  op_montant: number | null
  op_references: string | null
  department?: { id: string; name: string; color: string; slug: string } | null
  assignees?: { id: string; name: string; avatar_url?: string | null }[]
}
