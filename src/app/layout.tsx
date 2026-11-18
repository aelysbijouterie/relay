import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'RELAYS — Gestion de tâches',
  description: 'Application de gestion de tâches pour équipes bijoux',
  appleWebApp: { capable: true, title: 'RELAYS', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#7E6FB0' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}