import { loginAction, demoAction } from './actions'

const DEMO_DEPTS = [
  { slug: 'marketing',     name: 'Marketing',     color: '#7A7E2A', text: 'white' },
  { slug: 'web',           name: 'Web',           color: '#EB5C82', text: 'white' },
  { slug: 'administratif', name: 'Administratif', color: '#54673C', text: 'white' },
  { slug: 'rh',            name: 'RH',            color: '#3A7CB8', text: 'white' },
  { slug: 'logistique',    name: 'Logistique',    color: '#7A7E2A', text: 'white' },
  { slug: 'direction',     name: 'Direction',     color: '#0A2342', text: 'white' },
]

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const hasError = !!searchParams.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <h1 className="font-heading text-5xl font-bold tracking-tight">RELAYS</h1>
          <p className="text-muted-foreground mt-2 text-sm">Gestion de tâches · Aelys</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">

          {/* Accès démo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Accès démo par service
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_DEPTS.map(dept => (
                <form key={dept.slug} action={demoAction}>
                  <input type="hidden" name="slug" value={dept.slug} />
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ borderColor: `${dept.color}66`, color: dept.color }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                    {dept.name}
                  </button>
                </form>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou connexion avec compte</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Erreur */}
          {hasError && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              Identifiants incorrects — vérifie ton email et mot de passe.
            </div>
          )}

          {/* Formulaire */}
          <form action={loginAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium block mb-1.5">Adresse email</label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                placeholder="vous@aelys.fr"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium block mb-1.5">Mot de passe</label>
              <input
                id="password" name="password" type="password" required autoComplete="current-password"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Se connecter
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Accès réservé aux collaborateurs Aelys
        </p>
      </div>
    </div>
  )
}
