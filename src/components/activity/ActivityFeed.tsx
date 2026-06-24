'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Activity as ActivityIcon, Loader2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface ActivityItem {
  id: string
  type: string
  field: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
  actor_id: string | null
  actor: { id: string; name: string; avatar_url: string | null } | null
  task: { id: string; title: string; department: { name: string; color: string } | null } | null
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())

function label(a: ActivityItem): string {
  const F: Record<string, string> = {
    title: 'le titre', description: 'la description', priority: 'la priorité',
    deadline: "l'échéance", status: 'le statut',
    fournisseur_client: 'le fournisseur/client', ref_collection: 'la référence',
  }
  switch (a.type) {
    case 'created':    return 'a créé la carte'
    case 'status':     return `a changé le statut : ${a.old_value || '—'} → ${a.new_value || '—'}`
    case 'archived':   return a.new_value === 'Archivage automatique' ? 'a été archivée automatiquement' : 'a archivé la carte'
    case 'comment':    return 'a commenté'
    case 'subtask':    return 'a modifié les sous-tâches'
    case 'attachment': return 'a joint un fichier'
    case 'assignees':  return 'a modifié les assignations'
    case 'field':      return `a modifié ${F[a.field ?? ''] ?? a.field}`
    default:           return 'a modifié la carte'
  }
}

function dateGroup(d: string): string {
  const date = parseISO(d)
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return 'Hier'
  return format(date, 'd MMMM yyyy', { locale: fr })
}

export function ActivityFeed() {
  const router = useRouter()
  const { data, isLoading } = useSWR<{ items: ActivityItem[]; unread: number; lastSeen: string }>(
    '/api/activity', fetcher, { refreshInterval: 30000, revalidateOnFocus: true }
  )
  const [lastSeen, setLastSeen] = useState<string | null>(null)

  // À l'ouverture : mémoriser l'ancienne date de visite (pour surligner les
  // nouveautés), puis marquer comme lu côté serveur, puis rafraîchir la
  // pastille de la sidebar une fois le serveur à jour.
  useEffect(() => {
    if (data && lastSeen === null) {
      setLastSeen(data.lastSeen)
      ;(async () => {
        try {
          await fetch('/api/activity', { method: 'POST' })
        } finally {
          // La sidebar relira /api/activity et verra unread = 0
          window.dispatchEvent(new Event('activity-seen'))
        }
      })()
    }
  }, [data, lastSeen])

  const items = data?.items ?? []

  // Regroupement par jour
  const groups: { day: string; items: ActivityItem[] }[] = []
  for (const item of items) {
    const day = dateGroup(item.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }

  const isUnread = (a: ActivityItem) =>
    lastSeen && a.actor_id !== null && new Date(a.created_at) > new Date(lastSeen)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <ActivityIcon className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Activité récente</h1>
          <p className="text-sm text-muted-foreground">Les changements sur vos cartes</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Aucune activité pour l&apos;instant</p>
          <p className="text-sm mt-1">Les changements sur vos cartes apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.day}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.day}</p>
              <div className="space-y-1">
                {group.items.map(a => (
                  <button
                    key={a.id}
                    onClick={() => a.task && router.push(`/kanban?task=${a.task.id}`)}
                    className="w-full text-left bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:bg-muted transition-colors"
                    style={isUnread(a) ? { borderLeft: `3px solid ${a.task?.department?.color ?? '#6366f1'}` } : undefined}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[0.65rem] font-bold text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${a.task?.department?.color ?? '#6366f1'}, ${a.task?.department?.color ?? '#6366f1'}88)` }}>
                      {a.actor ? getInitials(a.actor.name) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{a.actor?.name ?? 'Quelqu\'un'}</span>{' '}
                        <span className="text-muted-foreground">{label(a)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.task?.title ?? 'Carte supprimée'}
                        {a.task?.department && ` · ${a.task.department.name}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(parseISO(a.created_at), 'HH:mm')}
                    </span>
                    {isUnread(a) && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}