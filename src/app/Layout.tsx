import { Camera } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { IndicateurSync } from '@/components/IndicateurSync'
import { MenuContactGlobal, RetourAction } from '@/features/actions/Actions'
import { useSuivables } from '@/features/aujourdhui/useSuivables'
import { mettreAJourPastille } from '@/services/notifications'
import { MODULES, ONGLETS } from './navigation'
import logo from '@/assets/logo.svg'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={logo} alt="" className="size-9 rounded-xl shadow-primaire" />
      <span className="text-lg font-extrabold tracking-tight">
        Prospect<span className="text-primaire">’Immo</span>
      </span>
    </Link>
  )
}

function BoutonReperer({ className = '' }: { className?: string }) {
  return (
    <Link to="/reperer" className={`degrade presse flex items-center justify-center gap-2 font-bold text-white shadow-primaire ${className}`}>
      <Camera className="size-5" strokeWidth={2.4} aria-hidden />
      <span>Repérer</span>
    </Link>
  )
}

/** Bandeau de la version de démonstration en ligne. */
function BandeauApercu() {
  return (
    <div className="degrade px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-xs font-semibold text-white">
      Aperçu de démonstration · contacts fictifs · rien n’est envoyé, tout reste dans votre navigateur
    </div>
  )
}

/** Pastille sur l'icône de l'application installée : relances en retard + du jour. */
function Pastille() {
  const { liste } = useSuivables()
  const n = liste?.filter((s) => s.couleur === 'rouge' || s.couleur === 'orange').length
  useEffect(() => {
    if (n !== undefined) mettreAJourPastille(n)
  }, [n])
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  // Capture terrain et formulaires : pas d'onglets ni de bouton flottant (place pour le bouton « Enregistrer »).
  const pleinEcran = pathname.startsWith('/reperer') || pathname.startsWith('/session') || pathname === '/communication/nouvelle' || /\/(nouveau|modifier)$/.test(pathname)

  return (
    <div className="flex min-h-dvh">
      {/* Barre latérale : tablette paysage et ordinateur */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 bg-surface px-5 py-6 shadow-carte lg:flex dark:shadow-none dark:ring-1 dark:ring-bord">
        <div className="flex items-center justify-between">
          <Logo />
          <IndicateurSync />
        </div>
        <BoutonReperer className="h-12 rounded-2xl" />
        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {[...ONGLETS.filter((o) => o.chemin !== '/plus'), ...MODULES].map(({ chemin, libelle, icone: Icone }) => (
            <NavLink
              key={chemin}
              to={chemin}
              end={chemin === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-primaire-doux text-primaire-texte' : 'text-doux hover:bg-surface-2 hover:text-texte'
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
        <Pastille />
        {import.meta.env.MODE === 'apercu' && <BandeauApercu />}
        {/* En-tête compact : smartphone et tablette portrait */}
        {!pleinEcran && (
          <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between bg-fond px-4 pt-[env(safe-area-inset-top)] lg:hidden">
            <Logo />
            <IndicateurSync />
          </header>
        )}

        <main
          key={pathname}
          className={`mx-auto w-full max-w-5xl flex-1 animate-apparition px-4 lg:px-10 lg:pb-10 lg:pt-8 ${pleinEcran ? 'pb-8 pt-[max(1rem,env(safe-area-inset-top))]' : 'pb-36 pt-2'}`}
        >
          <Suspense fallback={<div className="py-20 text-center text-doux">Chargement…</div>}>
            <Outlet />
          </Suspense>
        </main>

        <RetourAction />
        <MenuContactGlobal />

        {!pleinEcran && (
          <>
            <BoutonReperer className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 rounded-full px-6 text-base lg:hidden" />

            <nav
              aria-label="Onglets"
              className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 grid grid-cols-5 rounded-[28px] bg-surface/90 p-1.5 shadow-flottant ring-1 ring-bord/60 backdrop-blur-xl lg:hidden"
            >
              {ONGLETS.map(({ chemin, libelle, icone: Icone }) => (
                <NavLink
                  key={chemin}
                  to={chemin}
                  end={chemin === '/'}
                  className={({ isActive }) =>
                    `presse flex h-14 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-bold transition-colors ${
                      isActive ? 'bg-primaire-doux text-primaire-texte' : 'text-doux'
                    }`
                  }
                >
                  <Icone className="size-[22px]" strokeWidth={2.2} aria-hidden />
                  {libelle}
                </NavLink>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  )
}
