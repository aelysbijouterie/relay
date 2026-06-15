export const dynamic = 'force-dynamic'

import { fetchTasksForCurrentUser } from '@/lib/server/fetchTasks'
import { KanbanBoardServer } from '@/components/kanban/KanbanBoardServer'

export default async function KanbanPage() {
  const { tasks, currentDepartmentId, currentUserName } = await fetchTasksForCurrentUser()

  return (
    <KanbanBoardServer
      initialTasks={tasks}
      currentDepartmentId={currentDepartmentId}
      currentUserName={currentUserName}
    />
  )
}
