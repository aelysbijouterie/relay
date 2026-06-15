export const dynamic = 'force-dynamic'

import { fetchTasksForCurrentUser } from '@/lib/server/fetchTasks'
import { TimelineView } from '@/components/timeline/TimelineView'

export default async function TimelinePage() {
  const { tasks } = await fetchTasksForCurrentUser()
  return <TimelineView tasks={tasks} />
}
