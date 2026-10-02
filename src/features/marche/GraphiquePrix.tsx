import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { euros, kEuros } from './donnees'

export interface PointGraphique {
  annee: number
  mediane: number
  p25: number | null
  p75: number | null
  ventes: number | null
  comparaison?: number | null
}

const HAUTEUR = 230
const MARGES = { haut: 14, droite: 64, bas: 26, gauche: 46 }

function graduations(min: number, max: number): number[] {
  const brut = (max - min) / 4
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut
  const debut = Math.floor(min / pas) * pas
  const liste: number[] = []
  for (let v = debut; v <= max + pas / 2; v += pas) liste.push(v)
  return liste
}

/**
 * Évolution du prix médian (trait plein) avec la fourchette des prix « du milieu » (25 %–75 % des ventes, zone claire)
 * et, en option, la médiane d'une zone de comparaison. Survol ou appui : détail de l'année.
 */
export function GraphiquePrix({ points, libelle, libelleComparaison }: { points: PointGraphique[]; libelle: string; libelleComparaison?: string | null }) {
  const cadre = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(340)
  const [survol, setSurvol] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = cadre.current
    if (!el) return
    const obs = new ResizeObserver(() => setLargeur(el.clientWidth))
    obs.observe(el)
    setLargeur(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const g = useMemo(() => {
    const valeurs = points.flatMap((p) => [p.mediane, p.p25, p.p75, p.comparaison]).filter((v): v is number => v != null)
    const marge = (Math.max(...valeurs) - Math.min(...valeurs)) * 0.08 || 10000
    const ticks = graduations(Math.max(0, Math.min(...valeurs) - marge / 2), Math.max(...valeurs) + marge / 2)
    const [ymin, ymax] = [ticks[0]!, ticks[ticks.length - 1]!]
    const w = largeur - MARGES.gauche - MARGES.droite
    const h = HAUTEUR - MARGES.haut - MARGES.bas
    const [a0, a1] = [points[0]!.annee, points[points.length - 1]!.annee]
    const x = (annee: number) => MARGES.gauche + (a1 === a0 ? w / 2 : ((annee - a0) / (a1 - a0)) * w)
    const y = (v: number) => MARGES.haut + h - ((v - ymin) / (ymax - ymin)) * h
    const ligne = (cle: 'mediane' | 'comparaison') =>
      points
        .filter((p) => p[cle] != null)
        .map((p, i) => `${i ? 'L' : 'M'}${x(p.annee).toFixed(1)},${y(p[cle]!).toFixed(1)}`)
        .join(' ')
    const avecFourchette = points.filter((p) => p.p25 != null && p.p75 != null)
    const bande = avecFourchette.length > 1 ? `M${avecFourchette.map((p) => `${x(p.annee)},${y(p.p75!)}`).join(' L')} L${[...avecFourchette].reverse().map((p) => `${x(p.annee)},${y(p.p25!)}`).join(' L')} Z` : ''
    const pasAnnee = Math.max(1, Math.ceil((a1 - a0) / Math.max(1, Math.floor(w / 46))))
    return { x, y, ticks, ligne, bande, pasAnnee, a0, a1 }
  }, [points, largeur])

  if (points.length === 0) return null
  const actif = survol !== null ? points[survol] : null
  const dernier = points[points.length - 1]!

  const surDeplacement = (clientX: number) => {
    const rect = cadre.current!.getBoundingClientRect()
    const px = clientX - rect.left
    let meilleur = 0
    points.forEach((p, i) => {
      if (Math.abs(g.x(p.annee) - px) < Math.abs(g.x(points[meilleur]!.annee) - px)) meilleur = i
    })
    setSurvol(meilleur)
  }

  return (
    <div>
      {libelleComparaison && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-doux" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--viz-1)]" /> {libelle}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--viz-2)]" /> {libelleComparaison}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-[var(--viz-1)] opacity-15" /> 50 % des ventes
          </span>
        </div>
      )}
      <div
        ref={cadre}
        className="relative touch-pan-y select-none"
        onPointerMove={(e) => surDeplacement(e.clientX)}
        onPointerDown={(e) => surDeplacement(e.clientX)}
        onPointerLeave={() => setSurvol(null)}
      >
        <svg width={largeur} height={HAUTEUR} role="img" aria-label={`Évolution du prix médian, ${libelle}, de ${g.a0} à ${g.a1}`} className="block overflow-visible">
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={MARGES.gauche} x2={largeur - MARGES.droite} y1={g.y(t)} y2={g.y(t)} stroke="var(--bord)" strokeWidth={1} />
              <text x={MARGES.gauche - 6} y={g.y(t)} dy="0.32em" textAnchor="end" className="fill-doux text-[11px] tabular-nums">
                {kEuros(t)}
              </text>
            </g>
          ))}
          {points
            .filter((p) => (p.annee - g.a0) % g.pasAnnee === 0 || p.annee === g.a1)
            .map((p) => (
              <text key={p.annee} x={g.x(p.annee)} y={HAUTEUR - 6} textAnchor="middle" className="fill-doux text-[11px] tabular-nums">
                {p.annee}
              </text>
            ))}
          {g.bande && <path d={g.bande} fill="var(--viz-1)" opacity={0.14} />}
          {libelleComparaison && <path d={g.ligne('comparaison')} fill="none" stroke="var(--viz-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          <path d={g.ligne('mediane')} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Étiquette directe de la dernière valeur */}
          <text x={g.x(dernier.annee) + 8} y={g.y(dernier.mediane)} dy="0.32em" className="fill-texte text-[12px] font-bold tabular-nums">
            {kEuros(dernier.mediane)}
          </text>
          {actif && (
            <g>
              <line x1={g.x(actif.annee)} x2={g.x(actif.annee)} y1={MARGES.haut} y2={HAUTEUR - MARGES.bas} stroke="var(--doux)" strokeWidth={1} strokeDasharray="3 3" />
              {actif.comparaison != null && libelleComparaison && <circle cx={g.x(actif.annee)} cy={g.y(actif.comparaison)} r={5} fill="var(--viz-2)" stroke="var(--surface)" strokeWidth={2} />}
              <circle cx={g.x(actif.annee)} cy={g.y(actif.mediane)} r={5} fill="var(--viz-1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {actif && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-48 rounded-2xl bg-surface p-3 text-xs shadow-carte ring-1 ring-bord"
            style={{ left: Math.min(Math.max(g.x(actif.annee) - 96, 0), largeur - 192) }}
            role="status"
          >
            <p className="text-sm font-extrabold">{actif.annee}</p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-[var(--viz-1)]" aria-hidden /> Médiane : <strong className="ml-auto tabular-nums">{euros(actif.mediane)}</strong>
            </p>
            {actif.p25 != null && actif.p75 != null && (
              <p className="mt-0.5 text-doux tabular-nums">
                50 % entre {kEuros(actif.p25)} et {kEuros(actif.p75)}
              </p>
            )}
            {actif.ventes != null && <p className="mt-0.5 text-doux">{new Intl.NumberFormat('fr-BE').format(actif.ventes)} ventes</p>}
            {libelleComparaison && actif.comparaison != null && (
              <p className="mt-1 flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded bg-[var(--viz-2)]" aria-hidden /> {libelleComparaison} : <strong className="ml-auto tabular-nums">{kEuros(actif.comparaison)}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
