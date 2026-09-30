import { Camera } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { MODULES, ONGLETS } from './navigation'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
      <img src="/icon.svg" alt="" className="size-8" />
      <span className="text-lg">Linkimmo</span>
    </Link>
  )
}

function BoutonReperer({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/reperer"
      className={`flex items-center justify-center gap-2 rounded-full bg-accent font-bold text-accent-ink shadow-lg shadow-black/20 transition-transform active:scale-95 ${className}`}
    >
      <Camera className="size-6" aria-hidden />
      <span>Repérer</span>
    </Link>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  // Capture terrain et formulaires : pas d'onglets ni de bouton flottant (place pour le bouton « Enregistrer »).
  const pleinEcran = pathname.startsWith('/reperer') || /\/(nouveau|modifier)$/.test(pathname)

  return (
    <div className="flex min-h-full">
      {/* Barre latérale : tablette paysage et ordinateur */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-bord bg-surface p-4 lg:flex">
        <Logo />
        <BoutonReperer className="h-12" />
        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {[...ONGLETS.filter((o) => o.chemin !== '/plus'), ...MODULES].map(({ chemin, libelle, icone: Icone }) => (
            <NavLink
              key={chemin}
              to={chemin}
              end={chemin === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-ink text-accent dark:bg-accent dark:text-accent-ink' : 'text-doux hover:bg-surface-2 hover:text-texte'
                }`
              }
            >
              <Icone className="size-5" aria-hidden />
              {libelle}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête compact : smartphone et tablette portrait */}
        {!pleinEcran && (
          <header className="sticky top-0 z-20 flex h-[calc(3rem+env(safe-area-inset-top))] items-center justify-between border-b border-bord bg-fond px-4 pt-[env(safe-area-inset-top)] lg:hidden">
            <Logo />
          </header>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 animate-apparition px-4 pb-32 pt-4 lg:px-8 lg:pb-8 lg:pt-8" key={pathname}>
          <Suspense fallback={<div className="py-20 text-center text-doux">Chargement…</div>}>
            <Outlet />
          </Suspense>
        </main>

        {!pleinEcran && (
          <>
            <BoutonReperer className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 px-6 text-base lg:hidden" />

            <nav
              aria-label="Onglets"
              className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-bord bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
            >
              {ONGLETS.map(({ chemin, libelle, icone: Icone }) => (
                <NavLink
                  key={chemin}
                  to={chemin}
                  end={chemin === '/'}
                  className={({ isActive }) =>
                    `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                      isActive ? 'text-texte' : 'text-doux'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${isActive ? 'bg-accent text-accent-ink' : ''}`}>
                        <Icone className="size-5" aria-hidden />
                      </span>
                      {libelle}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  )
}
