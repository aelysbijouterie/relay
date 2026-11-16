'use client'

import { useEffect, useState } from 'react'
import { SCHOOL_ZONES, ZONE_COLORS, schoolZonesOn, type SchoolZone } from '@/lib/calendar/holidays'

const KEY = 'relays-school-zones'
const EVT = 'relays-school-zones-change'

function read(): SchoolZone[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const a = (JSON.parse(raw) as string[]).filter((z): z is SchoolZone => (SCHOOL_ZONES as string[]).includes(z)); return a }
  } catch { /* stockage indisponible : toutes les zones */ }
  return SCHOOL_ZONES
}

/** Zones affichées (mémorisées sur le poste, partagées entre tous les plannings ouverts). */
export function useSchoolZones(): [SchoolZone[], (z: SchoolZone[]) => void] {
  const [zones, setZones] = useState<SchoolZone[]>(SCHOOL_ZONES)
  useEffect(() => {
    setZones(read())
    const sync = () => setZones(read())
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync) }
  }, [])
  function save(next: SchoolZone[]) {
    setZones(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* noop */ }
    window.dispatchEvent(new Event(EVT))
  }
  return [zones, save]
}

/** Sélecteur de zones : une pastille cliquable par zone + rappel des académies. */
export function SchoolZoneToggle() {
  const [zones, setZones] = useSchoolZones()
  const toggle = (z: SchoolZone) => setZones(zones.includes(z) ? zones.filter(x => x !== z) : [...zones, z])
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vacances scolaires</span>
      {SCHOOL_ZONES.map(z => {
        const on = zones.includes(z)
        return (
          <button key={z} onClick={() => toggle(z)} aria-pressed={on}
            title={`Zone ${z}${on ? ' (affichée)' : ' (masquée)'}`}
            className="text-xs font-bold w-7 h-7 rounded-lg border transition-colors"
            style={on ? { backgroundColor: ZONE_COLORS[z], borderColor: ZONE_COLORS[z], color: '#fff' } : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            {z}
          </button>
        )
      })}
      <span className="text-[0.7rem] text-muted-foreground">A : Lyon, Grenoble, Bordeaux… · B : Lille, Nantes, Strasbourg… · C : Paris, Toulouse, Montpellier…</span>
    </div>
  )
}

/** Petites pastilles A / B / C à poser dans une case de jour. */
export function ZoneChips({ ds, zones, small = false }: { ds: string; zones: SchoolZone[]; small?: boolean }) {
  const on = schoolZonesOn(ds, zones)
  if (on.length === 0) return null
  return (
    <span className="inline-flex gap-px" aria-label={`Vacances zones ${on.join(', ')}`}>
      {on.map(z => (
        <span key={z} className={`inline-flex items-center justify-center rounded-sm font-bold text-white ${small ? 'text-[0.45rem] w-2.5 h-2.5' : 'text-[0.5rem] w-3 h-3'}`}
          style={{ backgroundColor: ZONE_COLORS[z] }}>{z}</span>
      ))}
    </span>
  )
}
