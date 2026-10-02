import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/Card'
import type { Evenement } from '@/data/types'
import { cleJour, grilleMois, VUES_AGENDA, type VueAgenda } from '@/domain/calendrier'
import { ajouterMois } from '@/domain/dates'
import { BoutonAppel, Visuel } from '@/features/aujourdhui/Sections'
import type { Suivable } from '@/features/aujourdhui/useSuivables'
import { HEURE, LigneEvenement } from './composants'

export interface Journee {
  rdv: Evenement[]
  relances: Suivable[]
}
export type ParJour = Map<string, Journee>
const VIDE: Journee = { rdv: [], relances: [] }
export const journee = (parJour: ParJour, d: Date) => parJour.get(cleJour(d)) ?? VIDE

export const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const TITRE_JOUR = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const NOM_MOIS = new Intl.DateTimeFormat('fr-BE', { month: 'long' })
const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function SelecteurVue({ vue, choisir }: { vue: VueAgenda; choisir: (v: VueAgenda) => void }) {
  return (
    <div role="radiogroup" aria-label="Présentation de l’agenda" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1">
      {VUES_AGENDA.map((v) => (
        <button
          key={v.code}
          type="button"
          role="radio"
          aria-checked={vue === v.code}
          onClick={() => choisir(v.code)}
          className={`presse h-10 rounded-xl text-[13px] font-bold transition ${vue === v.code ? 'bg-surface text-primaire-texte shadow-carte dark:ring-1 dark:ring-bord' : 'text-doux'}`}
        >
          {v.libelle}
        </button>
      ))}
    </div>
  )
}

export function NavPeriode({ titre, precedent, suivant, aujourdhui }: { titre: string; precedent: () => void; suivant: () => void; aujourdhui: (() => void) | null }) {
  const fleche = 'presse grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord'
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={precedent} className={fleche} aria-label="Période précédente">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-center text-base font-extrabold first-letter:uppercase" aria-live="polite">
        {titre}
      </h2>
      <button type="button" onClick={suivant} className={fleche} aria-label="Période suivante">
        <ChevronRight className="size-5" aria-hidden />
      </button>
      {aujourdhui && (
        <button type="button" onClick={aujourdhui} className="presse h-10 shrink-0 rounded-full bg-primaire-doux px-3 text-xs font-bold text-primaire-texte">
          Aujourd’hui
        </button>
      )}
    </div>
  )
}

export function LigneRelance({ s, retard }: { s: Suivable; retard: boolean }) {
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

/** Rendez-vous et relances d'un jour (vue Jour, et sous le calendrier du mois). */
export function DetailJour({ j, enRetard, ouvrir, ajouter }: { j: Journee; enRetard: Suivable[]; ouvrir: (e: Evenement) => void; ajouter: () => void }) {
  if (j.rdv.length === 0 && j.relances.length === 0 && enRetard.length === 0)
    return (
      <Card className="flex items-center gap-3">
        <CalendarDays className="size-5 text-doux" aria-hidden />
        <p className="flex-1 text-sm text-doux">Rien de prévu ce jour-là.</p>
        <button type="button" onClick={ajouter} className="text-sm font-bold text-primaire-texte">
          Ajouter
        </button>
      </Card>
    )
  const nbRelances = j.relances.length + enRetard.length
  return (
    <>
      {j.rdv.length > 0 && (
        <Card className="overflow-hidden !p-0">
          <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-doux">Rendez-vous</p>
          <div className="[&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
            {j.rdv.map((e) => (
              <LigneEvenement key={e.id} e={e} ouvrir={ouvrir} />
            ))}
          </div>
        </Card>
      )}
      {nbRelances > 0 && (
        <Card className="overflow-hidden !p-0">
          <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-doux">Relances ({nbRelances})</p>
          <div className="pb-1 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-bord/60">
            {enRetard.map((s) => (
              <LigneRelance key={s.cle} s={s} retard />
            ))}
            {j.relances.map((s) => (
              <LigneRelance key={s.cle} s={s} retard={false} />
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

/** Semaine : les 7 jours l'un sous l'autre ; toucher un jour l'ouvre en vue Jour. */
export function VueSemaine({ jours, parJour, aujourdhui, ouvrir, voirJour }: { jours: Date[]; parJour: ParJour; aujourdhui: Date; ouvrir: (e: Evenement) => void; voirJour: (d: Date) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {jours.map((d) => {
        const j = journee(parJour, d)
        const vide = j.rdv.length === 0 && j.relances.length === 0
        const estAujourdhui = memeJour(d, aujourdhui)
        return (
          <Card key={d.toISOString()} className={`overflow-hidden !p-0 ${estAujourdhui ? 'ring-2 ring-primaire' : ''}`}>
            <button type="button" onClick={() => voirJour(d)} className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-surface-2">
              <span className="flex-1 text-sm font-extrabold first-letter:uppercase">{TITRE_JOUR.format(d)}</span>
              {estAujourdhui && <span className="rounded-full bg-primaire-doux px-2 py-0.5 text-[11px] font-bold text-primaire-texte">Aujourd’hui</span>}
              {vide ? (
                <span className="text-xs text-doux">Rien de prévu</span>
              ) : (
                <span className="text-xs font-semibold text-doux">
                  {[j.rdv.length && `${j.rdv.length} RDV`, j.relances.length && `${j.relances.length} relance${j.relances.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-doux" aria-hidden />
            </button>
            {j.rdv.length > 0 && (
              <div className="border-t border-bord/60 [&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
                {j.rdv.map((e) => (
                  <LigneEvenement key={e.id} e={e} ouvrir={ouvrir} />
                ))}
              </div>
            )}
            {j.relances.length > 0 && (
              <div className="border-t border-bord/60 pb-1 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-bord/60">
                {j.relances.slice(0, 5).map((s) => (
                  <LigneRelance key={s.cle} s={s} retard={false} />
                ))}
                {j.relances.length > 5 && (
                  <button type="button" onClick={() => voirJour(d)} className="w-full px-4 py-2 text-left text-xs font-bold text-primaire-texte">
                    + {j.relances.length - 5} autres relances
                  </button>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function Pastilles({ j, clair }: { j: Journee; clair: boolean }) {
  return (
    <span className="flex h-1.5 gap-0.5">
      {j.rdv.length > 0 && <span className={`size-1.5 rounded-full ${clair ? 'bg-white' : 'bg-primaire'}`} />}
      {j.relances.length > 0 && <span className={`size-1.5 rounded-full ${clair ? 'bg-white/70' : 'bg-suivi-orange'}`} />}
    </span>
  )
}

/** Calendrier d'un mois : un point violet = rendez-vous, un point orange = relance. */
export function GrilleMois({
  mois,
  parJour,
  aujourdhui,
  choisi,
  choisir,
  compacte = false,
}: {
  mois: Date
  parJour: ParJour
  aujourdhui: Date
  choisi: Date | null
  choisir: (d: Date) => void
  compacte?: boolean
}) {
  return (
    <div role="grid" aria-label={NOM_MOIS.format(mois)}>
      <div role="row" className="grid grid-cols-7 pb-1">
        {INITIALES.map((l, i) => (
          <span key={i} role="columnheader" className="text-center text-[11px] font-bold text-doux">
            {l}
          </span>
        ))}
      </div>
      {grilleMois(mois).map((semaine) => (
        <div key={semaine[0]!.toISOString()} role="row" className="grid grid-cols-7 gap-0.5">
          {semaine.map((d) => {
            const dehors = d.getMonth() !== mois.getMonth()
            if (dehors && compacte) return <span key={d.toISOString()} role="gridcell" />
            const j = journee(parJour, d)
            const actif = !!choisi && memeJour(d, choisi)
            const estAujourdhui = memeJour(d, aujourdhui)
            const nb = j.rdv.length + j.relances.length
            return (
              <button
                key={d.toISOString()}
                type="button"
                role="gridcell"
                aria-selected={actif}
                aria-current={estAujourdhui ? 'date' : undefined}
                aria-label={`${TITRE_JOUR.format(d)}${nb ? ` : ${[j.rdv.length && `${j.rdv.length} rendez-vous`, j.relances.length && `${j.relances.length} relance${j.relances.length > 1 ? 's' : ''}`].filter(Boolean).join(', ')}` : ''}`}
                onClick={() => choisir(d)}
                className={`presse flex flex-col items-center justify-center gap-0.5 rounded-xl transition ${compacte ? 'h-9' : 'h-12'} ${
                  actif ? 'degrade text-white shadow-primaire' : estAujourdhui ? 'bg-primaire-doux text-primaire-texte' : dehors ? 'text-doux/50' : ''
                }`}
              >
                <span className={`font-bold tabular-nums leading-none ${compacte ? 'text-xs' : 'text-sm'}`}>{d.getDate()}</span>
                <Pastilles j={j} clair={actif} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Trimestre : trois mois côte à côte (l'un sous l'autre sur téléphone), avec le total de chaque mois. */
export function VueTrimestre({ debut, parJour, aujourdhui, voirJour, voirMois }: { debut: Date; parJour: ParJour; aujourdhui: Date; voirJour: (d: Date) => void; voirMois: (d: Date) => void }) {
  const mois = [0, 1, 2].map((i) => ajouterMois(debut, i))
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {mois.map((m) => {
        let rdv = 0
        let relances = 0
        for (const [cle, j] of parJour) {
          const [a, mm] = cle.split('-').map(Number)
          if (a === m.getFullYear() && mm === m.getMonth() + 1) {
            rdv += j.rdv.length
            relances += j.relances.length
          }
        }
        return (
          <Card key={m.toISOString()} className="!p-3">
            <button type="button" onClick={() => voirMois(m)} className="mb-2 flex w-full items-baseline justify-between gap-2 px-1 text-left">
              <span className="text-[15px] font-extrabold first-letter:uppercase">{NOM_MOIS.format(m)}</span>
              <span className="text-xs font-semibold text-doux">
                {rdv} RDV · {relances} relance{relances > 1 ? 's' : ''}
              </span>
            </button>
            <GrilleMois mois={m} parJour={parJour} aujourdhui={aujourdhui} choisi={null} choisir={voirJour} compacte />
          </Card>
        )
      })}
    </div>
  )
}
