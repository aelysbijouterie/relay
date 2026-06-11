import { z } from 'zod'

// Note: les IDs peuvent être des UUIDs Supabase OU des IDs démo (ex: 'u1', 'dept-marketing')
const idSchema = z.string().min(1)

export const taskSchema = z.object({
  title:              z.string().min(1, 'Le titre est requis').max(200),
  description:        z.string().optional(),
  status:             z.enum(['A Faire', 'En cours', 'Bloqué', 'A revoir', 'Terminé', 'Archivé']),
  priority:           z.enum(['Urgent', 'Élevée', 'Moyenne', 'Faible']),
  department_id:      idSchema,
  deadline:           z.string().optional().nullable(),
  is_cross_team:      z.boolean().default(false),
  extra_departments:  z.array(idSchema).optional(),
  fournisseur_client: z.string().optional().nullable(),
  ref_collection:     z.string().optional().nullable(),
  parent_task_id:     idSchema.optional().nullable(),
  assignees:          z.array(idSchema).optional(),
})

export type TaskFormValues = z.infer<typeof taskSchema>

export const updateStatusSchema = z.object({
  taskId: idSchema,
  status: z.enum(['A Faire', 'En cours', 'Bloqué', 'A revoir', 'Terminé', 'Archivé']),
})

export const savedFilterSchema = z.object({
  name:    z.string().min(1).max(100),
  filters: z.object({
    status:    z.array(z.enum(['A Faire', 'En cours', 'Bloqué', 'A revoir', 'Terminé', 'Archivé'])).optional(),
    priority:  z.array(z.enum(['Urgent', 'Élevée', 'Moyenne', 'Faible'])).optional(),
    assignees: z.array(idSchema).optional(),
  }),
})
