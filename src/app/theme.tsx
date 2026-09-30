import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ChoixTheme = 'auto' | 'clair' | 'sombre'
const CLE = 'linkimmo.theme'

function lire(): ChoixTheme {
  try {
    const v = localStorage.getItem(CLE)
    return v === 'clair' || v === 'sombre' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function appliquer(choix: ChoixTheme) {
  const sombre = choix === 'sombre' || (choix === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', sombre)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#0A0A0A' : '#FFFFFF')
}

const Ctx = createContext<{ theme: ChoixTheme; setTheme: (t: ChoixTheme) => void }>({
  theme: 'auto',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ChoixTheme>(lire)

  useEffect(() => {
    appliquer(theme)
    if (theme !== 'auto') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const suivre = () => appliquer('auto')
    mq.addEventListener('change', suivre)
    return () => mq.removeEventListener('change', suivre)
  }, [theme])

  const setTheme = (t: ChoixTheme) => {
    try {
      localStorage.setItem(CLE, t)
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    setThemeState(t)
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
