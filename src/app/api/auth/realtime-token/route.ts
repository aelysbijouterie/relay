import { NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/supabase/session'

export const dynamic = 'force-dynamic'

// Renvoie un access_token Supabase garanti valide (rafraîchi via le
// refresh_token si besoin) pour que le client Realtime du navigateur puisse
// s'authentifier (supabase.realtime.setAuth). Le cookie de session reste
// httpOnly : ce endpoint est le seul moyen pour le JS client d'obtenir ce
// jeton, et uniquement celui de son propre navigateur.
export async function GET() {
  const result = await getValidAccessToken()
  if (!result) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json(result)
}
