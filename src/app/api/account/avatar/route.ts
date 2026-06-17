import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BUCKET = 'avatars'
const MAX_BYTES = 5 * 1024 * 1024 // 5 Mo
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (JPEG, PNG, WebP ou GIF)' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image trop lourde (5 Mo maximum)' }, { status: 400 })
  }

  const supabase = createAdminClient()
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const ext    = (file.name.split('.').pop() ?? 'jpg').replace(/[^a-zA-Z0-9]/g, '')
  // Chemin déterministe par utilisateur + horodatage : upsert pour écraser
  // l'ancienne, le timestamp casse le cache navigateur sur l'URL publique.
  const path   = `${userId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)
    .select('id, avatar_url')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}