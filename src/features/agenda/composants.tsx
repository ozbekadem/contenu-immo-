import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck2, CalendarPlus, CalendarSync, ChevronRight, Loader2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { db } from '@/data/db'
import { titreEvenement } from '@/data/google/souhaites'
import { evenements } from '@/data/repositories/evenements'
import { TYPES_EVENEMENT, type Evenement } from '@/data/types'
import { connecterGoogle, deconnecterGoogle, synchroniserGoogle, useEtatGoogle } from '@/services/google'
import { FenetreEvenement, type PreRemplissage } from './FormulaireEvenement'

export const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' })
const JOUR_COURT = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })

const TEINTE_TYPE: Record<string, string> = {
  rdv: 'bg-primaire',
  estimation: 'bg-[#0ea5e9]',
  visite: 'bg-maison-vide',
  signature: 'bg-suivi-vert',
  autre: 'bg-doux',
}

/** Une ligne de rendez-vous : heure, type, titre, lieu. */
export function LigneEvenement({ e, ouvrir, avecJour = false }: { e: Evenement; ouvrir: (e: Evenement) => void; avecJour?: boolean }) {
  const contexte = useLiveQuery(async () => {
    const [contact, bien] = await Promise.all([e.contactId ? db.contacts.get(e.contactId) : undefined, e.bienId ? db.biens.get(e.bienId) : undefined])
    return { contact: contact ?? null, bien: bien ?? null }
  }, [e.contactId, e.bienId])
  const type = TYPES_EVENEMENT.find((t) => t.code === e.type)?.libelle
  return (
    <button type="button" onClick={() => ouvrir(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
      <span className="w-14 shrink-0 text-center">
        {avecJour && <span className="block text-[11px] font-bold uppercase text-doux">{JOUR_COURT.format(new Date(e.debut))}</span>}
        <span className="block text-[15px] font-extrabold tabular-nums">{e.journee ? 'Journée' : HEURE.format(new Date(e.debut))}</span>
      </span>
      <span className={`h-10 w-1 shrink-0 rounded-full ${TEINTE_TYPE[e.type]}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{titreEvenement(e, contexte?.contact ?? null, contexte?.bien ?? null)}</span>
        <span className="block truncate text-xs text-doux">{[type, e.lieu].filter(Boolean).join(' · ')}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-doux" aria-hidden />
    </button>
  )
}

/** Rendez-vous à venir d'un contact ou d'une piste, avec « + Rendez-vous ». */
export function RendezVousFiche({ pre }: { pre: PreRemplissage }) {
  const liste = useLiveQuery(() => evenements.aVenir({ contactId: pre.contactId, pisteId: pre.pisteId }), [pre.contactId, pre.pisteId])
  const [ouvert, setOuvert] = useState<Evenement | 'nouveau' | null>(null)
  return (
    <Card className="overflow-hidden !p-0">
      <div className="px-4 pt-4">
        <SectionTitle
          action={
            <button type="button" onClick={() => setOuvert('nouveau')} className={`${classesBouton('fantome')} h-9 px-3 text-xs`}>
              <CalendarPlus className="size-4" aria-hidden /> Rendez-vous
            </button>
          }
        >
          Rendez-vous
        </SectionTitle>
      </div>
      {liste?.length ? (
        <div className="pb-1 [&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
          {liste.map((e) => (
            <LigneEvenement key={e.id} e={e} ouvrir={setOuvert} avecJour />
          ))}
        </div>
      ) : (
        <p className="px-4 pb-4 text-sm text-doux">Aucun rendez-vous prévu.</p>
      )}
      <FenetreEvenement ouverte={ouvert !== null} fermer={() => setOuvert(null)} existant={ouvert === 'nouveau' ? null : ouvert} pre={pre} />
    </Card>
  )
}

const ilYa = (iso: string | null) => {
  if (!iso) return null
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  return min < 1 ? 'à l’instant' : min < 60 ? `il y a ${min} min` : `à ${HEURE.format(new Date(iso))}`
}

/** État de la liaison avec Google Agenda, et le bouton pour (re)connecter. */
export function CarteGoogle({ compacte = false }: { compacte?: boolean }) {
  const g = useEtatGoogle()
  const [occupe, setOccupe] = useState(false)
  const action = async (f: () => Promise<void>) => {
    setOccupe(true)
    try {
      await f()
    } catch {
      /* message affiché par l'état */
    }
    setOccupe(false)
  }

  if (g.statut === 'non_configure')
    return (
      <Card className="flex items-start gap-3">
        <CalendarSync className="mt-0.5 size-5 shrink-0 text-doux" aria-hidden />
        <p className="text-sm text-doux">
          <strong className="text-texte">Google Agenda pas encore relié.</strong> L’agenda fonctionne déjà dans l’application ; la liaison avec Google sera activée dès que
          l’accès Google aura été créé (guide pas à pas fourni).
        </p>
      </Card>
    )

  const lie = g.statut === 'ok' || g.statut === 'synchro' || g.statut === 'erreur'
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${lie ? 'bg-suivi-vert/12 text-suivi-vert' : 'bg-primaire-doux text-primaire-texte'}`}>
          {g.statut === 'synchro' ? <Loader2 className="size-5 animate-spin" aria-hidden /> : g.statut === 'erreur' ? <TriangleAlert className="size-5 text-suivi-orange" aria-hidden /> : <CalendarCheck2 className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">Google Agenda</p>
          <p className="text-xs text-doux">
            {g.statut === 'deconnecte' && 'Relances et rendez-vous dans votre Google Agenda (calendrier « Linkimmo »).'}
            {g.statut === 'a_reconnecter' && 'Connexion expirée : touchez « Reconnecter » pour reprendre la synchronisation.'}
            {g.statut === 'synchro' && 'Synchronisation…'}
            {g.statut === 'ok' && `Synchronisé ${ilYa(g.derniereSync) ?? ''}`}
            {g.statut === 'erreur' && (g.message ?? 'Erreur de synchronisation')}
          </p>
        </div>
        {(g.statut === 'deconnecte' || g.statut === 'a_reconnecter') && (
          <button type="button" disabled={occupe} onClick={() => action(connecterGoogle)} className={`${classesBouton('primaire')} h-10 shrink-0 px-4 text-sm`}>
            {g.statut === 'deconnecte' ? 'Connecter' : 'Reconnecter'}
          </button>
        )}
        {(g.statut === 'ok' || g.statut === 'erreur') && compacte && (
          <button type="button" onClick={() => void synchroniserGoogle()} className={`${classesBouton('fantome')} h-10 shrink-0 px-3 text-xs`}>
            Synchroniser
          </button>
        )}
      </div>
      {g.message && g.statut !== 'erreur' && <p className="text-xs font-semibold text-suivi-rouge">{g.message}</p>}
      {!compacte && lie && (
        <div className="flex gap-2">
          <button type="button" onClick={() => void synchroniserGoogle()} className={`${classesBouton('fantome')} h-10 flex-1 text-xs`}>
            Synchroniser maintenant
          </button>
          <button type="button" onClick={() => action(deconnecterGoogle)} className={`${classesBouton('fantome')} h-10 flex-1 text-xs text-doux`}>
            Déconnecter
          </button>
        </div>
      )}
    </Card>
  )
}


/** « Rendez-vous du jour » sur l'accueil. */
export function RendezVousDuJour({ maintenant }: { maintenant: Date }) {
  const debut = new Date(maintenant)
  debut.setHours(0, 0, 0, 0)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + 1)
  const liste = useLiveQuery(() => evenements.entre(debut, fin), [debut.toDateString()])
  const [ouvert, setOuvert] = useState<Evenement | null>(null)
  if (!liste?.length) return null
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <CalendarCheck2 className="size-5 text-primaire-texte" aria-hidden />
        <h2 className="text-base font-bold">Rendez-vous du jour</h2>
        <span className="rounded-full bg-primaire-doux px-2 py-0.5 text-xs font-bold text-primaire-texte">{liste.length}</span>
      </div>
      <div className="[&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
        {liste.map((e) => (
          <LigneEvenement key={e.id} e={e} ouvrir={setOuvert} />
        ))}
      </div>
      <FenetreEvenement ouverte={ouvert !== null} fermer={() => setOuvert(null)} existant={ouvert} />
    </Card>
  )
}
