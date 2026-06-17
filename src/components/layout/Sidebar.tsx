'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Columns, Calendar, BarChart2, Clock, User, LogOut, Menu, X } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { logout } from '@/lib/actions/auth'
import type { Profile, Department } from '@/types'

const NAV_ITEMS = [
  { href: '/kanban',     label: 'Kanban',       icon: Columns },
  { href: '/calendrier', label: 'Calendrier',   icon: Calendar },
  { href: '/timeline',   label: 'Chronologie',  icon: Clock },
  { href: '/stats',      label: 'Statistiques', icon: BarChart2 },
  { href: '/compte',     label: 'Mon compte',   icon: User },
]

interface SidebarProps {
  profile: Profile
  members: Profile[]
  department: Department
  extraDepartments?: Department[]
}

export function Sidebar({ profile, members, department, extraDepartments = [] }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function switchDepartment(deptId: string) {
    await fetch('/api/auth/switch-dept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptId }),
    })
    router.refresh()
  }

  async function handleLogout() {
    // Efface le cookie démo si présent, puis déconnexion Supabase via Server Action
    await fetch('/api/auth/demo', { method: 'DELETE' })
    await logout()
    router.push('/login')
    router.refresh()
  }

  const content = (
    <div
      className="flex flex-col h-full glass border-r-0"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${department.color}, ${department.color}99)`,
              boxShadow: `0 4px 14px ${department.color}55`,
            }}
          >
            R
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">RELAYS</span>
        </div>
        <button className="lg:hidden p-1 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setOpen(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Department chip / switcher */}
      <div className="px-4 pt-4 pb-2 space-y-1.5">
        {extraDepartments.length > 0 && (
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Mes services
          </p>
        )}

        {/* Service actif */}
        <div
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium text-white"
          style={{
            background: `linear-gradient(135deg, ${department.color}dd, ${department.color}99)`,
            boxShadow: `0 2px 8px ${department.color}44`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
          {department.name}
        </div>

        {/* Autres services — un clic pour basculer */}
        {extraDepartments.map(d => (
          <button
            key={d.id}
            onClick={() => switchDepartment(d.id)}
            title={`Basculer vers ${d.name}`}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border border-white/20 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors w-full"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            {d.name}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                active
                  ? 'text-white font-medium shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/10'
              )}
              style={active ? {
                background: `linear-gradient(135deg, ${department.color}ee, ${department.color}99)`,
                boxShadow: `0 4px 14px ${department.color}44`,
              } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Team members */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Équipe</p>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Aucun membre</p>
          )}
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ring-2 ring-white/20"
                style={{ background: `linear-gradient(135deg, ${department.color}cc, ${department.color}88)` }}
              >
                {member.avatar_url
                  ? <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover rounded-full" />
                  : getInitials(member.name)
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          <Link
            href="/compte"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 min-w-0 flex-1 rounded-lg p-1 -m-1 hover:bg-white/10 transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ring-2"
              style={{
                background: `linear-gradient(135deg, ${department.color}, ${department.color}88)`,
              }}
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover rounded-full" />
                : getInitials(profile.name)
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{profile.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title="Déconnexion"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass rounded-xl shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-4 h-4" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <aside className="hidden lg:flex flex-col flex-shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      <aside className={cn(
        'lg:hidden fixed left-0 top-0 z-50 h-full transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {content}
      </aside>
    </>
  )
}