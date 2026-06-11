import { redirect } from 'next/navigation'

// Le middleware gère la redirection vers /login si non connecté.
// Si connecté, on atterrit ici et on va directement au kanban.
export default function Home() {
  redirect('/kanban')
}
