import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ChoixTheme = 'auto' | 'clair' | 'sombre'
export type Palette = 'indigo' | 'lagon' | 'corail'

export const PALETTES: { code: Palette; libelle: string; couleurs: [string, string] }[] = [
  { code: 'indigo', libelle: 'Indigo', couleurs: ['#4f46e5', '#8b5cf6'] },
  { code: 'lagon', libelle: 'Lagon', couleurs: ['#0d9488', '#0ea5e9'] },
  { code: 'corail', libelle: 'Corail', couleurs: ['#e8505b', '#f59e0b'] },
]

const CLE_THEME = 'linkimmo.theme'
const CLE_PALETTE = 'linkimmo.palette'

function lire<T extends string>(cle: string, valides: readonly T[], defaut: T): T {
  try {
    const v = localStorage.getItem(cle) as T | null
    return v && valides.includes(v) ? v : defaut
  } catch {
    return defaut
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}

function appliquer(choix: ChoixTheme, palette: Palette) {
  const html = document.documentElement
  // Thème imposé par la page hôte (aperçu de démonstration) : data-theme="dark" ou "light".
  const impose = html.dataset.theme
  const systemeSombre = impose ? impose === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  const sombre = choix === 'sombre' || (choix === 'auto' && systemeSombre)
  html.classList.toggle('dark', sombre)
  html.dataset.palette = palette
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#0B0F1C' : '#F4F5FA')
}

interface Ctx {
  theme: ChoixTheme
  setTheme: (t: ChoixTheme) => void
  palette: Palette
  setPalette: (p: Palette) => void
}

const Contexte = createContext<Ctx>({ theme: 'auto', setTheme: () => {}, palette: 'indigo', setPalette: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ChoixTheme>(() => lire(CLE_THEME, ['auto', 'clair', 'sombre'], 'auto'))
  const [palette, setPaletteState] = useState<Palette>(() => lire(CLE_PALETTE, ['indigo', 'lagon', 'corail'], 'indigo'))

  useEffect(() => {
    appliquer(theme, palette)
    if (theme !== 'auto') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const suivre = () => appliquer('auto', palette)
    mq.addEventListener('change', suivre)
    return () => mq.removeEventListener('change', suivre)
  }, [theme, palette])

  const setTheme = (t: ChoixTheme) => {
    ecrire(CLE_THEME, t)
    setThemeState(t)
  }
  const setPalette = (p: Palette) => {
    ecrire(CLE_PALETTE, p)
    setPaletteState(p)
  }

  return <Contexte.Provider value={{ theme, setTheme, palette, setPalette }}>{children}</Contexte.Provider>
}

export const useTheme = () => useContext(Contexte)
