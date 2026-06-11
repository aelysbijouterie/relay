import { StatsView } from '@/components/stats/StatsView'
import { DEMO_TASKS } from '@/lib/demo-data'

export default function StatsPage() {
  return <StatsView tasks={DEMO_TASKS} />
}
