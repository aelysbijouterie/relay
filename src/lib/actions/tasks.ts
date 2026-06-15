'use server'

import { createServerClient, getCurrentUserId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { taskSchema } from '@/lib/validations/task'
import type { TaskStatus, Task } from '@/types'

export async function createTask(data: unknown) {
  const userId = getCurrentUserId()
  const supabase = createServerClient()

  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.errors[0].message)

  const { assignees, extra_departments, ...taskData } = parsed.data

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...taskData, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (assignees?.length) {
    await supabase.from('task_assignees').insert(
      assignees.map(user_id => ({ task_id: task.id, user_id }))
    )
  }

  if (parsed.data.is_cross_team && extra_departments?.length) {
    await supabase.from('task_departments').insert(
      extra_departments.map(department_id => ({ task_id: task.id, department_id }))
    )
  }

  return { success: true, taskId: task.id }
}

export async function updateTask(taskId: string, data: unknown) {
  getCurrentUserId()
  const supabase = createServerClient()

  const parsed = taskSchema.partial().safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.errors[0].message)

  const { assignees, extra_departments, ...taskData } = parsed.data

  const { error } = await supabase
    .from('tasks')
    .update({ ...taskData, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw new Error(error.message)

  if (assignees !== undefined) {
    await supabase.from('task_assignees').delete().eq('task_id', taskId)
    if (assignees.length) {
      await supabase.from('task_assignees').insert(
        assignees.map(user_id => ({ task_id: taskId, user_id }))
      )
    }
  }

  if (extra_departments !== undefined) {
    await supabase.from('task_departments').delete().eq('task_id', taskId)
    if (extra_departments.length) {
      await supabase.from('task_departments').insert(
        extra_departments.map(department_id => ({ task_id: taskId, department_id }))
      )
    }
  }

  return { success: true }
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  getCurrentUserId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/kanban')
}

export async function deleteTask(taskId: string) {
  getCurrentUserId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/kanban')
  return { success: true }
}

export async function getTasks(filters?: {
  myTasksOnly?: boolean
  status?: TaskStatus
  departmentId?: string
}) {
  const userId = getCurrentUserId()
  const supabase = createServerClient()

  let query = supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, department_id, created_by,
      department:departments(id, name, color, slug, icon),
      creator:profiles!tasks_created_by_fkey(id, name, avatar_url),
      assignees:task_assignees(user:profiles(id, name, avatar_url)),
      extra_departments:task_departments(department:departments(id, name, color, slug))
    `)
    .neq('status', 'Archivé')
    .order('deadline', { ascending: true, nullsFirst: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.myTasksOnly) {
    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', userId)

    const taskIds = assignedTasks?.map(r => r.task_id) ?? []
    const idList = taskIds.length > 0 ? taskIds.join(',') : 'no-match'
    query = query.or(`created_by.eq.${userId},id.in.(${idList})`)
  }

  const { data, error } = await query.limit(200)
  if (error) throw new Error(error.message)

  return data as unknown as Task[]
}

export async function saveFavoriteFilter(name: string, filters: Record<string, unknown>) {
  const userId = getCurrentUserId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('saved_filters')
    .insert({ user_id: userId, name, filters })

  if (error) throw new Error(error.message)
  return { success: true }
}
