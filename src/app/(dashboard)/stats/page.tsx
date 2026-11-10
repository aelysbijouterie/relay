import { redirect } from 'next/navigation'

// L'onglet Statistiques a été supprimé pour tout le monde : les anciens liens renvoient au Kanban.
export default function StatsPage() {
  redirect('/kanban')
}
