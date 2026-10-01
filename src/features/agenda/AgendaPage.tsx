import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { evenements } from '@/data/repositories/evenements'
import type { Evenement } from '@/data/types'
import { ajouterJours, debutJour } from '@/domain/dates'
import { BoutonAppel, Visuel } from '@/features/aujourdhui/Sections'
import { useSuivables, type Suivable } from '@/features/aujourdhui/useSuivables'
import { CarteGoogle, HEURE, LigneEvenement } from './composants'
import { creneauParDefaut, FenetreEvenement } from './FormulaireEvenement'

const AVANT = 3
const APRES = 41
const NOM_JOUR = new Intl.DateTimeFormat('fr-BE', { weekday: 'short' })
const TITRE_JOUR = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })

const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString()

function LigneRelance({ s, retard }: { s: Suivable; retard: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 pl-4 pr-2">
      <Link to={s.lien} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
        <span className="w-14 shrink-0 text-center text-[13px] font-bold tabular-nums text-doux">{retard ? 'Retard' : HEURE.format(new Date(s.prochaineRelanceAt!))}</span>
        <Visuel s={s} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{s.titre}</span>
          <span className={`block text-xs font-semibold ${retard ? 'text-suivi-rouge' : 'text-doux'}`}>
            Relance{retard ? ` prévue le ${new Date(s.prochaineRelanceAt!).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}` : ''}
          </span>
        </span>
      </Link>
      <BoutonAppel s={s} />
    </div>
  )
}

/** Agenda : rendez-vous et relances jour par jour, relié au calendrier « Linkimmo » de Google Agenda. */
export default function AgendaPage() {
  const { liste: suivables, maintenant } = useSuivables()
  const aujourdhui = useMemo(() => debutJour(maintenant), [maintenant])
  const [jour, setJour] = useState(aujourdhui)
  const [ouvert, setOuvert] = useState<Evenement | 'nouveau' | null>(null)
  const bande = useRef<HTMLDivElement>(null)

  const jours = useMemo(() => Array.from({ length: AVANT + APRES }, (_, i) => ajouterJours(aujourdhui, i - AVANT)), [aujourdhui])
  const periode = useLiveQuery(() => evenements.entre(jours[0]!, ajouterJours(jours[jours.length - 1]!, 1)), [jours])

  useEffect(() => {
    bande.current?.querySelector('[aria-current="date"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  const relancesDu = (d: Date) => (suivables ?? []).filter((s) => s.prochaineRelanceAt && memeJour(new Date(s.prochaineRelanceAt), d) && !s.contact?.nePasContacter)
  const evenementsDu = (d: Date) => (periode ?? []).filter((e) => memeJour(new Date(e.debut), d) || (new Date(e.debut) < d && new Date(e.fin) > d))
  const enRetard = memeJour(jour, aujourdhui)
    ? (suivables ?? []).filter((s) => s.prochaineRelanceAt && new Date(s.prochaineRelanceAt) < aujourdhui && !s.contact?.nePasContacter)
    : []
  const duJour = evenementsDu(jour)
  const relances = relancesDu(jour).sort((a, b) => a.prochaineRelanceAt!.localeCompare(b.prochaineRelanceAt!))
  const prochains = (periode ?? []).filter((e) => new Date(e.debut) >= ajouterJours(jour, 1)).slice(0, 8)

  const preNouveau = () => {
    const d = new Date(jour)
    if (memeJour(jour, aujourdhui)) {
      const c = new Date(maintenant)
      c.setMinutes(0, 0, 0)
      c.setHours(c.getHours() + 1)
      return c
    }
    d.setHours(creneauParDefaut().getHours(), 0, 0, 0)
    return d
  }

  return (
    <>
      <PageHeader
        titre="Agenda"
        action={
          <button type="button" onClick={() => setOuvert('nouveau')} className={`${classesBouton('primaire')} h-11 px-4`}>
            <Plus className="size-5" aria-hidden /> Rendez-vous
          </button>
        }
      />

      <div ref={bande} className="sans-barre -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Jour">
        {jours.map((d) => {
          const actif = memeJour(d, jour)
          const nbRdv = evenementsDu(d).length
          const nbRelances = relancesDu(d).length
          return (
            <button
              key={d.toISOString()}
              type="button"
              role="tab"
              aria-selected={actif}
              aria-current={memeJour(d, aujourdhui) ? 'date' : undefined}
              aria-label={TITRE_JOUR.format(d)}
              onClick={() => setJour(d)}
              className={`presse flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2 transition ${actif ? 'degrade text-white shadow-primaire' : memeJour(d, aujourdhui) ? 'bg-primaire-doux text-primaire-texte' : 'bg-surface text-texte ring-1 ring-bord/60'}`}
            >
              <span className={`text-[11px] font-bold uppercase ${actif ? 'text-white/85' : 'text-doux'}`}>{NOM_JOUR.format(d).replace('.', '')}</span>
              <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
              <span className="flex h-1.5 gap-0.5">
                {nbRdv > 0 && <span className={`size-1.5 rounded-full ${actif ? 'bg-white' : 'bg-primaire'}`} />}
                {nbRelances > 0 && <span className={`size-1.5 rounded-full ${actif ? 'bg-white/70' : 'bg-suivi-orange'}`} />}
              </span>
            </button>
          )
        })}
      </div>

      <h2 className="mt-4 text-lg font-extrabold first-letter:uppercase">{memeJour(jour, aujourdhui) ? 'Aujourd’hui' : TITRE_JOUR.format(jour)}</h2>

      <div className="mt-2 flex flex-col gap-4">
        {duJour.length === 0 && relances.length === 0 && enRetard.length === 0 ? (
          <Card className="flex items-center gap-3">
            <CalendarDays className="size-5 text-doux" aria-hidden />
            <p className="flex-1 text-sm text-doux">Rien de prévu ce jour-là.</p>
            <button type="button" onClick={() => setOuvert('nouveau')} className="text-sm font-bold text-primaire-texte">
              Ajouter
            </button>
          </Card>
        ) : (
          <>
            {duJour.length > 0 && (
              <Card className="overflow-hidden !p-0">
                <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-doux">Rendez-vous</p>
                <div className="[&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
                  {duJour.map((e) => (
                    <LigneEvenement key={e.id} e={e} ouvrir={setOuvert} />
                  ))}
                </div>
              </Card>
            )}
            {(relances.length > 0 || enRetard.length > 0) && (
              <Card className="overflow-hidden !p-0">
                <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-doux">
                  Relances {relances.length + enRetard.length > 0 && `(${relances.length + enRetard.length})`}
                </p>
                <div className="pb-1 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-bord/60">
                  {enRetard.map((s) => (
                    <LigneRelance key={s.cle} s={s} retard />
                  ))}
                  {relances.map((s) => (
                    <LigneRelance key={s.cle} s={s} retard={false} />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {prochains.length > 0 && (
          <Card className="overflow-hidden !p-0">
            <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-doux">Rendez-vous suivants</p>
            <div className="[&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
              {prochains.map((e) => (
                <LigneEvenement key={e.id} e={e} ouvrir={setOuvert} avecJour />
              ))}
            </div>
          </Card>
        )}

        <CarteGoogle compacte />
      </div>

      <FenetreEvenement ouverte={ouvert !== null} fermer={() => setOuvert(null)} existant={ouvert === 'nouveau' ? null : ouvert} pre={{ debut: preNouveau() }} />
    </>
  )
}
