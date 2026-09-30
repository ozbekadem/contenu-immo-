import { CalendarX2 } from 'lucide-react'
import { Saisie } from '@/components/ui/Champ'
import { depuisDateLocale, versDateLocale } from '@/domain/dates'
import { dateRelance, DELAIS_RELANCE } from '@/domain/relance'

const FORMAT = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Choix de la prochaine relance en un appui : +1 semaine, +1 mois, +3 mois, +6 mois ou date au choix. */
export function RelanceChoix({ valeur, onChange }: { valeur: string | null; onChange: (iso: string | null) => void }) {
  const jour = versDateLocale(valeur)
  const aujourdhui = new Date()
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        {DELAIS_RELANCE.map(({ code, libelle }) => {
          const iso = depuisDateLocale(versDateLocale(dateRelance(code, aujourdhui).toISOString()))!
          const actif = jour === versDateLocale(iso)
          return (
            <button
              key={code}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(iso)}
              className={`presse h-12 rounded-2xl text-sm font-bold transition-colors ${actif ? 'degrade text-white shadow-primaire' : 'bg-primaire-doux text-primaire-texte'}`}
            >
              {libelle}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Saisie
          type="date"
          aria-label="Date de relance"
          value={jour}
          min={versDateLocale(aujourdhui.toISOString())}
          onChange={(e) => onChange(depuisDateLocale(e.target.value))}
          className="flex-1"
        />
        {valeur && (
          <button type="button" onClick={() => onChange(null)} className="presse flex h-12 items-center gap-1.5 rounded-2xl bg-surface-2 px-3 text-sm font-semibold text-doux">
            <CalendarX2 className="size-4" aria-hidden /> Aucune
          </button>
        )}
      </div>
      <p className="text-sm text-doux">
        {valeur ? (
          <>
            Relance prévue le <strong className="text-texte first-letter:uppercase">{FORMAT.format(new Date(valeur))}</strong>
          </>
        ) : (
          'Aucune relance planifiée.'
        )}
      </p>
    </div>
  )
}
