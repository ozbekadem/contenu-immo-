import { Delete } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Pavé numérique pour un code à 4–6 chiffres.
 * Avec `longueur`, le code est envoyé dès le dernier chiffre ; sans, un bouton OK apparaît à partir de 4 chiffres.
 */
export function PaveCode({
  longueur,
  surCode,
  desactive = false,
  erreur = 0,
  toucheGauche,
}: {
  longueur?: number
  surCode: (code: string) => void | Promise<void>
  desactive?: boolean
  /** Incrémenté à chaque erreur : vide la saisie et fait trembler les points. */
  erreur?: number
  toucheGauche?: ReactNode
}) {
  const [code, setCode] = useState('')
  const [tremble, setTremble] = useState(false)
  const max = longueur ?? 6

  useEffect(() => {
    if (!erreur) return
    setCode('')
    setTremble(true)
    const t = setTimeout(() => setTremble(false), 400)
    return () => clearTimeout(t)
  }, [erreur])

  const taper = (chiffre: string) => {
    if (desactive || code.length >= max) return
    const suivant = code + chiffre
    setCode(suivant)
    if (longueur && suivant.length === longueur) void Promise.resolve(surCode(suivant)).finally(() => setCode(''))
  }

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) taper(e.key)
      else if (e.key === 'Backspace') setCode((c) => c.slice(0, -1))
      else if (e.key === 'Enter' && !longueur && code.length >= 4) void surCode(code)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  })

  const touche = 'presse grid size-[4.5rem] place-items-center justify-self-center rounded-full text-2xl font-bold tabular-nums disabled:opacity-40'
  return (
    <div className="flex w-full max-w-72 flex-col items-center gap-6">
      <div className={`flex h-4 gap-3 ${tremble ? 'animate-tremble' : ''}`} role="status" aria-label={`${code.length} chiffre${code.length > 1 ? 's' : ''} tapé${code.length > 1 ? 's' : ''}`}>
        {Array.from({ length: longueur ?? Math.max(4, code.length) }, (_, i) => (
          <span key={i} className={`size-3.5 rounded-full transition ${i < code.length ? 'bg-primaire' : 'ring-2 ring-bord'}`} />
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-x-4 gap-y-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => (
          <button key={c} type="button" disabled={desactive} onClick={() => taper(c)} className={`${touche} bg-surface-2`}>
            {c}
          </button>
        ))}
        {longueur ? (
          <div className="grid place-items-center">{toucheGauche}</div>
        ) : (
          <button type="button" disabled={desactive || code.length < 4} onClick={() => void surCode(code)} className={`${touche} degrade !text-base text-white`}>
            OK
          </button>
        )}
        <button type="button" disabled={desactive} onClick={() => taper('0')} className={`${touche} bg-surface-2`}>
          0
        </button>
        <button type="button" disabled={desactive || !code} onClick={() => setCode(code.slice(0, -1))} className={touche} aria-label="Effacer un chiffre">
          <Delete className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  )
}
