'use server'

import { redirect } from 'next/navigation'

export async function logout() {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  cookieStore.delete('relays-session')
  cookieStore.delete('relays-demo')
  cookieStore.delete('relays-active-dept')
  redirect('/login')
}
