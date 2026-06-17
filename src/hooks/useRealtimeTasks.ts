'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'

const REFRESH_SAFETY_MARGIN_SECONDS = 60       // on ré-authentifie un peu avant l'expiration réelle
const FALLBACK_RETRY_DELAY_MS       = 45 * 60 * 1000 // si expires_at absent ou après une erreur transitoire
const MIN_REFRESH_DELAY_MS          = 30_000   // garde-fou anti boucle serrée

/**
 * Abonnement Supabase Realtime sur les tâches, avec ré-authentification
 * périodique pour rester valide indéfiniment (pas seulement pendant la
 * durée de vie du premier access_token).
 *
 * Le Kanban affiche toutes les tâches visibles (filtre "Mes tâches" géré
 * côté client), donc on écoute sans filtre de département : les policies
 * RLS scopent déjà ce que chaque utilisateur a le droit de recevoir.
 *
 * Prérequis indispensables côté Supabase, sans quoi cet abonnement ne reçoit
 * jamais rien (silencieusement, sans erreur) :
 * 1. tasks / task_assignees / task_departments dans la publication
 *    `supabase_realtime` (migration 004_realtime.sql).
 * 2. Le client doit être authentifié via `realtime.setAuth()` avec un vrai
 *    access_token utilisateur, sinon `auth.uid()` est NULL côté RLS.
 *
 * /api/auth/realtime-token rafraîchit cet access_token via le refresh_token
 * stocké côté serveur (cookie httpOnly) dès qu'il approche de l'expiration,
 * donc ce hook reste authentifié aussi longtemps que le refresh_token reste
 * valide (en pratique : aussi longtemps que la session de 7 jours dure et
 * que l'utilisateur reste actif).
 */
export function useRealtimeTasks() {
  useEffect(() => {
    const supabase = createClient()
    const refresh = () => { void mutate('/api/tasks') }

    let channel: ReturnType<typeof supabase.channel> | null = null
    let timer:   ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function scheduleNextAuth(expiresAt: number | undefined) {
      if (cancelled) return
      const nowSeconds = Math.floor(Date.now() / 1000)
      const delayMs = expiresAt
        ? Math.max((expiresAt - nowSeconds - REFRESH_SAFETY_MARGIN_SECONDS) * 1000, MIN_REFRESH_DELAY_MS)
        : FALLBACK_RETRY_DELAY_MS
      timer = setTimeout(() => { void authenticate() }, delayMs)
    }

    async function authenticate() {
      try {
        const res = await fetch('/api/auth/realtime-token', { cache: 'no-store' })
        if (cancelled) return

        // 401 = pas de session réelle (mode démo, déconnecté…) : on
        // n'insiste pas, le polling SWR reste la seule source de vérité.
        if (!res.ok) return

        const body = (await res.json()) as { access_token?: string; expires_at?: number }
        if (!body.access_token || cancelled) return

        await supabase.realtime.setAuth(body.access_token)
        if (cancelled) return

        if (!channel) {
          channel = supabase
            .channel('relays-tasks')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, refresh)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, refresh)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, refresh)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_assignees' }, refresh)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_assignees' }, refresh)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_departments' }, refresh)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_departments' }, refresh)
            .subscribe()
        }

        scheduleNextAuth(body.expires_at)
      } catch {
        // Erreur transitoire (réseau...) — on retentera plus tard plutôt
        // que d'abandonner le temps réel pour le reste de la session.
        scheduleNextAuth(undefined)
      }
    }

    void authenticate()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])
}
