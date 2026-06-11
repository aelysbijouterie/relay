import { CalendarView } from '@/components/calendar/CalendarView'
import { DEMO_TASKS } from '@/lib/demo-data'

export default function CalendrierPage() {
  return <CalendarView tasks={DEMO_TASKS} />
}
