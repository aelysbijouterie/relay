'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Loader2, Mail } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
}

type Saving = 'idle' | 'saving' | 'saved'

const NOTIF_OPTIONS: { key: NotifKey; label: string; description: string }[] = [
  { key: 'notify_email_assigned',  label: 'Tâche assignée',       description: "Quand une tâche m'est attribuée" },
  { key: 'notify_email_status',    label: 'Changement de statut', description: "Quand le statut d'une de mes tâches change" },
  { key: 'notify_email_deadlines', label: "Rappels d'échéance",   description: 'À l\'approche des dates limites (J-3, J-1)' },
  { key: 'notify_email_weekly',    label: 'Résumé hebdomadaire',  description: 'Un récapitulatif chaque semaine' },
]

type NotifKey =
  | 'notify_email_assigned'
  | 'notify_email_status'
  | 'notify_email_deadlines'
  | 'notify_email_weekly'

export function AccountView({ profile }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const deptColor = profile.department?.color ?? '#6366f1'

  const [name, setName] = useState(profile.name)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [prefs, setPrefs] = useState<Record<NotifKey, boolean>>({
    notify_email_assigned:  profile.notify_email_assigned  ?? true,
    notify_email_status:    profile.notify_email_status    ?? true,
    notify_email_deadlines: profile.notify_email_deadlines ?? true,
    notify_email_weekly:    profile.notify_email_weekly    ?? false,
  })

  const [nameSaving, setNameSaving] = useState<Saving>('idle')
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function saveName() {
    if (name.trim() === profile.name || name.trim().length === 0) return
    setNameSaving('saving')
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      setNameSaving('saved')
      router.refresh()
      setTimeout(() => setNameSaving('idle'), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setNameSaving('idle')
    }
  }

  async function togglePref(key: NotifKey) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
    } catch (e) {
      // Revenir à l'état précédent en cas d'échec
      setPrefs(prefs)
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/account/avatar', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Échec de l\'envoi')
      const data = await res.json()
      setAvatarUrl(data.avatar_url)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations et vos préférences</p>
      </div>

      {error && (
        <div className="glass-card p-3 text-sm text-red-500 border border-red-500/30">{error}</div>
      )}

      {/* Photo + identité */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white overflow-hidden ring-2 ring-white/20"
              style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}88)` }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                : getInitials(name)}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              title="Changer la photo"
              aria-label="Changer la photo de profil"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onPickFile}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <p className="font-medium text-lg truncate">{name}</p>
            <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium text-white mt-2 capitalize"
              style={{ background: `linear-gradient(135deg, ${deptColor}dd, ${deptColor}99)` }}
            >
              {profile.role}{profile.department ? ` · ${profile.department.name}` : ''}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4">JPEG, PNG, WebP ou GIF · 5 Mo maximum</p>
      </section>

      {/* Nom */}
      <section className="glass-card p-6 space-y-3">
        <label htmlFor="account-name" className="block text-sm font-medium">Nom complet</label>
        <div className="flex gap-2">
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder="Votre nom"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={nameSaving === 'saving' || name.trim() === profile.name || name.trim().length === 0}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white shadow-md transition-opacity disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}99)` }}
          >
            {nameSaving === 'saving'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : nameSaving === 'saved'
                ? <Check className="w-4 h-4" />
                : 'Enregistrer'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">L'email et le rôle sont gérés par un administrateur.</p>
      </section>

      {/* Préférences de notification */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-medium">Notifications par email</h2>
        </div>
        <div className="space-y-1">
          {NOTIF_OPTIONS.map(({ key, label, description }) => (
            <label
              key={key}
              htmlFor={key}
              className="flex items-center justify-between gap-4 py-3 px-1 cursor-pointer border-b border-white/5 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <button
                id={key}
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => togglePref(key)}
                className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors"
                style={{ backgroundColor: prefs[key] ? deptColor : 'rgba(255,255,255,0.15)' }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: prefs[key] ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}