import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { HOME_COOKIE, sanitizeHome } from '@/lib/home-view'

// Le middleware gère la redirection vers /login si non connecté.
// Si connecté, on va sur la vue favorite de la personne (Kanban par défaut).
export default function Home() {
  redirect(sanitizeHome(cookies().get(HOME_COOKIE)?.value))
}
