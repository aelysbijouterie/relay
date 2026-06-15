export const dynamic = 'force-dynamic'

import { fetchTasksForCurrentUser } from '@/lib/server/fetchTasks'
import { CalendarView } from '@/components/calendar/CalendarView'

export default async function CalendrierPage() {
  const { tasks } = await fetchTasksForCurrentUser()
  return <CalendarView tasks={tasks} />
}
