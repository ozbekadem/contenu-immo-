import { useLayoutEffect, useRef, useState } from 'react'

const HAUTEUR = 150
const BAS = 22
const HAUT = 18
const JOUR = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })

/** Appels par semaine (barres fines, une seule série) ; la part « joints » est indiquée au survol et dans le tableau. */
export function BarresSemaines({ semaines }: { semaines: { debut: Date; appels: number; joints: number }[] }) {
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
  const max = Math.max(1, ...semaines.map((s) => s.appels))
  const pas = largeur / semaines.length
  const barre = Math.min(22, pas * 0.6)
  const h = HAUTEUR - BAS - HAUT
  const actif = survol !== null ? semaines[survol] : null

  return (
    <div ref={cadre} className="relative select-none" onPointerLeave={() => setSurvol(null)}>
      <svg width={largeur} height={HAUTEUR} role="img" aria-label={`Appels par semaine sur ${semaines.length} semaines`} className="block">
        <line x1={0} x2={largeur} y1={HAUTEUR - BAS} y2={HAUTEUR - BAS} stroke="var(--bord)" />
        {semaines.map((s, i) => {
          const hb = (s.appels / max) * h
          const x = i * pas + (pas - barre) / 2
          const y = HAUTEUR - BAS - hb
          return (
            <g key={s.debut.toISOString()} onPointerEnter={() => setSurvol(i)} onPointerDown={() => setSurvol(i)}>
              <rect x={i * pas} y={0} width={pas} height={HAUTEUR} fill="transparent" />
              {s.appels > 0 && <path d={`M${x},${HAUTEUR - BAS} V${y + 4} q0,-4 4,-4 h${barre - 8} q4,0 4,4 V${HAUTEUR - BAS} Z`} fill="var(--viz-1)" opacity={survol === null || survol === i ? 1 : 0.45} />}
              {(i === semaines.length - 1 || survol === i) && s.appels > 0 && (
                <text x={x + barre / 2} y={y - 4} textAnchor="middle" className="fill-texte text-[11px] font-bold tabular-nums">
                  {s.appels}
                </text>
              )}
              {(i % 3 === semaines.length % 3 || i === semaines.length - 1) && (
                <text x={x + barre / 2} y={HAUTEUR - 6} textAnchor="middle" className="fill-doux text-[10px]">
                  {JOUR.format(s.debut)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {actif && (
        <div className="pointer-events-none absolute top-0 rounded-xl bg-surface px-3 py-2 text-xs shadow-carte ring-1 ring-bord" style={{ left: Math.min(Math.max(survol! * pas - 50, 0), largeur - 150) }} role="status">
          <p className="font-bold">Semaine du {JOUR.format(actif.debut)}</p>
          <p className="tabular-nums">
            {actif.appels} appel{actif.appels > 1 ? 's' : ''}, {actif.joints} joint{actif.joints > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
