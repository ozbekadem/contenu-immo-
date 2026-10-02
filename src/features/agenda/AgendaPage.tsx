import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { evenements } from '@/data/repositories/evenements'
import type { Evenement } from '@/data/types'
import { cleJour, debutSemaine, decaler, plageVue, titrePeriode, VUES_AGENDA, type VueAgenda } from '@/domain/calendrier'
import { ajouterJours, debutJour } from '@/domain/dates'
import { useSuivables } from '@/features/aujourdhui/useSuivables'
import { CarteGoogle, LigneEvenement } from './composants'
import { DetailJour, GrilleMois, journee, memeJour, NavPeriode, SelecteurVue, VueSemaine, VueTrimestre, type ParJour } from './Vues'
import { creneauParDefaut, FenetreEvenement } from './FormulaireEvenement'

const AVANT = 3
const APRES = 41
const CLE_VUE = 'linkimmo.agenda.vue'
const NOM_JOUR = new Intl.DateTimeFormat('fr-BE', { weekday: 'short' })
const TITRE_JOUR = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })

function vueMemorisee(): VueAgenda {
  try {
    const v = localStorage.getItem(CLE_VUE) as VueAgenda | null
    return v && VUES_AGENDA.some((x) => x.code === v) ? v : 'jour'
  } catch {
    return 'jour'
  }
}

/** Agenda : rendez-vous et relances par jour, semaine, mois ou trimestre, relié au calendrier « Linkimmo » de Google Agenda. */
export default function AgendaPage() {
  const { liste: suivables, maintenant } = useSuivables()
  const aujourdhui = useMemo(() => debutJour(maintenant), [maintenant])
  const [vue, setVue] = useState<VueAgenda>(vueMemorisee)
  const [jour, setJour] = useState(aujourdhui)
  const [ouvert, setOuvert] = useState<Evenement | 'nouveau' | null>(null)
  const bande = useRef<HTMLDivElement>(null)

  const choisirVue = (v: VueAgenda) => {
    setVue(v)
    try {
      localStorage.setItem(CLE_VUE, v)
    } catch {
      /* non mémorisé */
    }
  }
  const voirJour = (d: Date) => {
    setJour(debutJour(d))
    choisirVue('jour')
  }

  // Bande de jours (vue Jour) : autour d'aujourd'hui, ou autour du jour choisi s'il est plus loin.
  const debutBande = useMemo(() => {
    const defaut = ajouterJours(aujourdhui, -AVANT)
    return jour >= defaut && jour < ajouterJours(aujourdhui, APRES) ? defaut : ajouterJours(jour, -AVANT)
  }, [aujourdhui, jour])
  const jours = useMemo(() => Array.from({ length: AVANT + APRES }, (_, i) => ajouterJours(debutBande, i)), [debutBande])

  // Période à charger : la bande (vue Jour) ou les semaines complètes affichées.
  const plage = useMemo(() => {
    if (vue === 'jour') return { du: jours[0]!, au: ajouterJours(jours[jours.length - 1]!, 1) }
    const p = plageVue(vue, jour)
    return vue === 'mois' ? { du: debutSemaine(p.du), au: ajouterJours(debutSemaine(ajouterJours(p.au, -1)), 7) } : p
  }, [vue, jour, jours])
  const periode = useLiveQuery(() => evenements.entre(plage.du, plage.au), [plage.du.getTime(), plage.au.getTime()])

  const parJour = useMemo(() => {
    const m: ParJour = new Map()
    const case_ = (d: Date) => {
      const c = cleJour(d)
      let j = m.get(c)
      if (!j) m.set(c, (j = { rdv: [], relances: [] }))
      return j
    }
    for (const e of periode ?? []) {
      // Un rendez-vous sur plusieurs jours apparaît chaque jour (dans la période affichée).
      const fin = new Date(e.fin)
      for (let d = debutJour(new Date(Math.max(new Date(e.debut).getTime(), plage.du.getTime()))); d < fin && d < plage.au; d = ajouterJours(d, 1)) case_(d).rdv.push(e)
    }
    for (const s of suivables ?? []) {
      if (!s.prochaineRelanceAt || s.contact?.nePasContacter) continue
      const d = new Date(s.prochaineRelanceAt)
      if (d >= plage.du && d < plage.au) case_(d).relances.push(s)
    }
    for (const j of m.values()) j.relances.sort((a, b) => a.prochaineRelanceAt!.localeCompare(b.prochaineRelanceAt!))
    return m
  }, [periode, suivables, plage])

  useEffect(() => {
    if (vue === 'jour') bande.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [vue, jour, debutBande])

  const enRetard = memeJour(jour, aujourdhui)
    ? (suivables ?? []).filter((s) => s.prochaineRelanceAt && new Date(s.prochaineRelanceAt) < aujourdhui && !s.contact?.nePasContacter)
    : []
  const prochains = (periode ?? []).filter((e) => new Date(e.debut) >= ajouterJours(jour, 1)).slice(0, 8)
  const plageAffichee = plageVue(vue, jour)
  const contientAujourdhui = aujourdhui >= plageAffichee.du && aujourdhui < plageAffichee.au

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

      <div className="mb-3">
        <SelecteurVue vue={vue} choisir={choisirVue} />
      </div>

      {vue === 'jour' ? (
        <>
          <div ref={bande} className="sans-barre -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Jour">
            {jours.map((d) => {
              const actif = memeJour(d, jour)
              const j = journee(parJour, d)
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
                    {j.rdv.length > 0 && <span className={`size-1.5 rounded-full ${actif ? 'bg-white' : 'bg-primaire'}`} />}
                    {j.relances.length > 0 && <span className={`size-1.5 rounded-full ${actif ? 'bg-white/70' : 'bg-suivi-orange'}`} />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="flex-1 text-lg font-extrabold first-letter:uppercase">{memeJour(jour, aujourdhui) ? 'Aujourd’hui' : TITRE_JOUR.format(jour)}</h2>
            {!memeJour(jour, aujourdhui) && (
              <button type="button" onClick={() => setJour(aujourdhui)} className="presse h-9 rounded-full bg-primaire-doux px-3 text-xs font-bold text-primaire-texte">
                Aujourd’hui
              </button>
            )}
          </div>
        </>
      ) : (
        <NavPeriode
          titre={titrePeriode(vue, jour)}
          precedent={() => setJour(decaler(vue, jour, -1))}
          suivant={() => setJour(decaler(vue, jour, 1))}
          aujourdhui={contientAujourdhui ? null : () => setJour(aujourdhui)}
        />
      )}

      <div className="mt-3 flex flex-col gap-4">
        {vue === 'jour' && (
          <>
            <DetailJour j={journee(parJour, jour)} enRetard={enRetard} ouvrir={setOuvert} ajouter={() => setOuvert('nouveau')} />
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
          </>
        )}

        {vue === 'semaine' && (
          <VueSemaine jours={Array.from({ length: 7 }, (_, i) => ajouterJours(plageAffichee.du, i))} parJour={parJour} aujourdhui={aujourdhui} ouvrir={setOuvert} voirJour={voirJour} />
        )}

        {vue === 'mois' && (
          <>
            <Card className="!p-3">
              <GrilleMois mois={plageAffichee.du} parJour={parJour} aujourdhui={aujourdhui} choisi={jour} choisir={(d) => setJour(debutJour(d))} />
              <p className="mt-2 flex justify-center gap-4 text-[11px] font-semibold text-doux">
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-primaire" /> Rendez-vous
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-suivi-orange" /> Relances
                </span>
              </p>
            </Card>
            <h3 className="-mb-2 text-base font-extrabold first-letter:uppercase">{memeJour(jour, aujourdhui) ? 'Aujourd’hui' : TITRE_JOUR.format(jour)}</h3>
            <DetailJour j={journee(parJour, jour)} enRetard={enRetard} ouvrir={setOuvert} ajouter={() => setOuvert('nouveau')} />
          </>
        )}

        {vue === 'trimestre' && (
          <VueTrimestre
            debut={plageAffichee.du}
            parJour={parJour}
            aujourdhui={aujourdhui}
            voirJour={voirJour}
            voirMois={(m) => {
              setJour(m)
              choisirVue('mois')
            }}
          />
        )}

        <CarteGoogle compacte />
      </div>

      <FenetreEvenement ouverte={ouvert !== null} fermer={() => setOuvert(null)} existant={ouvert === 'nouveau' ? null : ouvert} pre={{ debut: preNouveau() }} />
    </>
  )
}
