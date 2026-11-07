import { useEffect, useState } from 'react'
import { Saisie } from './Champ'

const format = (n: number | null | undefined) => (n == null ? '' : new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 2 }).format(n))

/** Lit « 150 000 », « 150.000 », « 12,5 » ou « 150k » ; null si vide ou illisible. */
export function lireNombre(texte: string): number | null {
  const t = texte.trim().toLowerCase().replace(/[\s  €%]/g, '')
  if (!t) return null
  const k = t.endsWith('k')
  let c = k ? t.slice(0, -1) : t
  // « 150.000 » = milliers ; « 12,5 » ou « 12.5 » = décimales
  if (/^\d{1,3}(\.\d{3})+$/.test(c)) c = c.replace(/\./g, '')
  c = c.replace(',', '.')
  const n = Number(c)
  if (!Number.isFinite(n) || n < 0) return null
  return k ? n * 1000 : n
}

/** Champ numérique : affiché à la belge (« 150 000 »), enregistré quand on quitte le champ. */
export function SaisieNombre({
  valeur,
  enregistrer,
  suffixe,
  placeholder,
  label,
  className = '',
}: {
  valeur: number | null | undefined
  enregistrer: (n: number | null) => void
  suffixe?: string
  placeholder?: string
  label: string
  className?: string
}) {
  const [texte, setTexte] = useState(format(valeur))
  useEffect(() => setTexte(format(valeur)), [valeur])
  const valider = () => {
    const n = lireNombre(texte)
    if (n !== (valeur ?? null)) enregistrer(n)
    setTexte(format(n))
  }
  return (
    <span className={`relative block ${className}`}>
      <Saisie
        inputMode="decimal"
        aria-label={label}
        placeholder={placeholder}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={suffixe ? 'pr-11' : ''}
      />
      {suffixe && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-doux">{suffixe}</span>}
    </span>
  )
}
