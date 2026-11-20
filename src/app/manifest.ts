import type { MetadataRoute } from 'next'

// RELAYS installable comme une application (fenêtre dédiée, sans barre d'adresse du navigateur).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RELAYS — Aelys Bijouterie',
    short_name: 'RELAYS',
    description: 'Gestion de tâches, congés et opérations — Aelys Bijouterie',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#7E6FB0',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
