import { TimelineView } from '@/components/timeline/TimelineView'
import { DEMO_TASKS } from '@/lib/demo-data'

export default function TimelinePage() {
  return <TimelineView tasks={DEMO_TASKS} />
}
