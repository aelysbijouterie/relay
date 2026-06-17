import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'task-attachments'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_attachments')
    .select('id, file_name, file_url, file_size, file_type, created_at, created_by')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  const supabase = createAdminClient()

  // S'assurer que le bucket existe
  await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  const ext      = file.name.split('.').pop() ?? ''
  const path     = `${params.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // Signed URL pour les buckets privés
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365)
  const fileUrl = signed?.signedUrl ?? publicUrl

  const { data, error } = await supabase
    .from('task_attachments')
    .insert({
      task_id:    params.id,
      file_name:  file.name,
      file_url:   fileUrl,
      file_size:  file.size,
      file_type:  file.type || ext,
      created_by: userId,
    })
    .select('id, file_name, file_url, file_size, file_type, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { attachmentId, path } = await request.json()
  const supabase = createAdminClient()

  if (path) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
  }

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('task_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
