import { createAdminClient } from '@/lib/supabase/server'

export type ActivityType =
  | 'created' | 'status' | 'field' | 'comment'
  | 'subtask' | 'attachment' | 'assignees' | 'archived'

interface LogInput {
  taskId: string
  actorId: string
  type: ActivityType
  field?: string
  oldValue?: string | null
  newValue?: string | null
}

/**
 * Écrit une ligne d'historique. Volontairement « best effort » : si le log
 * échoue, on ne fait jamais échouer l'action métier qui l'a déclenché
 * (on ne bloque pas un changement de statut parce que l'historique a un souci).
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('task_activity').insert({
      task_id:   input.taskId,
      actor_id:  input.actorId,
      type:      input.type,
      field:     input.field ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
    })
  } catch (e) {
    console.error('logActivity failed:', e)
  }
}

/**
 * Détermine si un utilisateur peut modifier / archiver / supprimer une tâche.
 * Règle (validée avec le métier) : créateur, assigné, manager ou admin.
 * Comme tout passe par le client admin (bypass RLS), ce contrôle applicatif
 * est la seule barrière réelle — il doit être appelé par chaque route qui
 * modifie une carte.
 */
export async function canMutateTask(taskId: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'admin' || profile?.role === 'manager') return true

  const { data: task } = await supabase
    .from('tasks')
    .select('created_by')
    .eq('id', taskId)
    .single()

  if (task?.created_by === userId) return true

  const { data: assignee } = await supabase
    .from('task_assignees')
    .select('user_id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!assignee
}