import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, Mail, MessageCircle, MessageSquare, NotebookPen, Phone, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RelanceChoix } from '@/components/RelanceChoix'
import { classesBouton } from '@/components/ui/Bouton'
import { Saisie, Zone } from '@/components/ui/Champ'
import { Feuille } from '@/components/ui/Feuille'
import { contacts } from '@/data/repositories/contacts'
import { evenements, evenementVide } from '@/data/repositories/evenements'
import { interactions } from '@/data/repositories/interactions'
import { creneauParDefaut } from '@/features/agenda/FormulaireEvenement'
import { biens } from '@/data/repositories/biens'
import { pistes } from '@/data/repositories/pistes'
import type { Contact, Piste } from '@/data/types'
import { adresseCourte } from '@/features/prospection/affichage'
import { depuisDateLocale, versDateLocale } from '@/domain/dates'
import { RESULTATS, resultatsPour, type CodeResultat } from '@/domain/resultats'
import { heureOuvrable } from '@/domain/relance'
import { formaterTelephone, ordreCanaux, type Canal } from '@/domain/telephone'
import { nomAffiche } from '@/features/contacts/affichage'
import { fermerMenuContact, lancerAction, lienPour, noterEchange, signalerResultat, surRetour, terminerAction, useActionEnCours, useMenuContact } from './actions'

export const CANAUX: Record<Canal, { libelle: string; icone: LucideIcon; classe: string }> = {
  appel: { libelle: 'Appeler', icone: Phone, classe: 'degrade text-white shadow-primaire' },
  whatsapp: { libelle: 'WhatsApp', icone: MessageCircle, classe: 'bg-whatsapp text-white shadow-[0_10px_24px_-8px_#25d366]' },
  sms: { libelle: 'SMS', icone: MessageSquare, classe: 'bg-primaire-doux text-primaire-texte' },
  email: { libelle: 'Email', icone: Mail, classe: 'bg-primaire-doux text-primaire-texte' },
}

/**
 * Menu de contact en un appui : le canal le plus utilisé pour ce contact en premier,
 * puis noter un échange sans appeler.
 */
export function MenuContact({
  contact,
  numero,
  pisteId = null,
  ouvert,
  fermer,
}: {
  contact: Contact
  numero?: string | null
  pisteId?: string | null
  ouvert: boolean
  fermer: () => void
}) {
  const tel = numero ?? contact._telNorm[0]
  const canaux = ordreCanaux(contact.utilisationCanaux, !!contact.emails[0]).filter((c) => lienPour(c, contact, numero))
  return (
    <Feuille titre={nomAffiche(contact)} ouverte={ouvert} fermer={fermer}>
      {tel && <p className="-mt-3 mb-4 text-sm font-semibold text-doux">{formaterTelephone(tel)}</p>}
      {contact.nePasContacter && (
        <p className="mb-3 rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">Ce contact a demandé à ne plus être contacté.</p>
      )}
      <div className="flex flex-col gap-2">
        {canaux.map((c, i) => {
          const { libelle, icone: Icone, classe } = CANAUX[c]
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                fermer()
                lancerAction(contact, c, numero, pisteId)
              }}
              className={`presse flex h-14 items-center gap-3 rounded-2xl px-4 text-left font-bold ${i === 0 ? classe : 'bg-surface-2'}`}
            >
              <Icone className="size-5" aria-hidden />
              <span className="flex-1">{c === 'email' ? `${libelle} · ${contact.emails[0]}` : libelle}</span>
              {i === 0 && Object.keys(contact.utilisationCanaux).length > 0 && <span className="text-xs font-semibold opacity-80">le plus utilisé</span>}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            fermer()
            noterEchange(contact.id, pisteId)
          }}
          className="presse flex h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left font-bold"
        >
          <NotebookPen className="size-5" aria-hidden /> Noter un échange (sans appeler)
        </button>
      </div>
    </Feuille>
  )
}

const TON: Record<'positif' | 'neutre' | 'negatif', string> = {
  positif: 'bg-suivi-vert/12 text-suivi-vert',
  neutre: 'bg-surface-2 text-texte',
  negatif: 'bg-suivi-rouge/10 text-suivi-rouge',
}

const TITRE: Record<string, string> = {
  appel: 'Comment s’est passé l’appel ?',
  whatsapp: 'Message WhatsApp',
  sms: 'SMS',
  email: 'Email',
  note: 'Noter un échange',
}

function SaisieResultat({
  contact,
  piste,
  canal,
  numero,
  fermer,
}: {
  contact: Contact | null
  piste: Piste | null
  canal: Canal | 'note'
  numero: string | null
  fermer: () => void
}) {
  const choix = resultatsPour(canal, piste?.categorie ?? 'portefeuille')
  const suivi = piste ?? contact!
  const [resultat, setResultat] = useState<CodeResultat | null>(canal === 'note' ? 'note' : null)
  const [commentaire, setCommentaire] = useState('')
  const [relance, setRelance] = useState<string | null>(suivi.prochaineRelanceAt)
  const [relanceManuelle, setRelanceManuelle] = useState(false)
  const [occupe, setOccupe] = useState(false)
  // « RDV obtenu » / « Visite » : on l'inscrit tout de suite à l'agenda (et dans Google Agenda).
  const defautRdv = creneauParDefaut()
  const [rdvAgenda, setRdvAgenda] = useState(true)
  const [rdvJour, setRdvJour] = useState(versDateLocale(defautRdv.toISOString()))
  const [rdvHeure, setRdvHeure] = useState('10:00')
  const avecRdv = resultat === 'rdv' || resultat === 'visite'

  const choisir = (code: CodeResultat) => {
    setResultat(code)
    // Relance proposée selon le résultat (demain pour « pas de réponse », +1 mois pour « rappeler »…)
    if (!relanceManuelle) {
      const defaut = RESULTATS[code].relanceParDefaut?.(new Date())
      setRelance(defaut ? depuisDateLocale(versDateLocale(defaut.toISOString()), heureOuvrable(defaut)) : code === 'note' ? suivi.prochaineRelanceAt : null)
    }
  }

  const enregistrer = async () => {
    if (!resultat) return
    setOccupe(true)
    await interactions.enregistrerResultat({
      contactId: contact?.id ?? null,
      pisteId: piste?.id ?? null,
      type: canal,
      resultat,
      commentaire,
      relance: relance ? new Date(relance) : null,
      numero,
    })
    if (avecRdv && rdvAgenda && rdvJour) {
      const [a, m, j] = rdvJour.split('-').map(Number)
      const [h, mi] = rdvHeure.split(':').map(Number)
      const debut = new Date(a!, m! - 1, j!, h ?? 10, mi ?? 0)
      await evenements.creer(
        {
          ...evenementVide(debut),
          type: resultat === 'visite' ? 'visite' : piste ? 'estimation' : 'rdv',
          notes: commentaire.trim(),
          contactId: contact?.id ?? null,
          pisteId: piste?.id ?? null,
          bienId: piste?.bienId ?? null,
        },
        { demo: !!(contact?._demo || piste?._demo) },
      )
    }
    setOccupe(false)
    signalerResultat({ contactId: contact?.id ?? null, pisteId: piste?.id ?? null, resultat })
    fermer()
  }

  return (
    <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Résultat">
        {choix.map((code) => {
          const r = RESULTATS[code]
          const actif = resultat === code
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => choisir(code)}
              className={`presse h-11 rounded-full px-4 text-sm font-bold transition ${actif ? 'degrade text-white shadow-primaire' : TON[r.ton]}`}
            >
              {r.libelle}
            </button>
          )
        })}
      </div>
      {avecRdv && (
        <div className="rounded-2xl bg-primaire-doux p-3">
          <label className="flex items-center gap-2 text-sm font-bold text-primaire-texte">
            <input type="checkbox" checked={rdvAgenda} onChange={(e) => setRdvAgenda(e.target.checked)} className="size-5 accent-[var(--color-primaire)]" />
            Ajouter le rendez-vous à l’agenda
          </label>
          {rdvAgenda && (
            <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
              <Saisie type="date" aria-label="Date du rendez-vous" value={rdvJour} onChange={(e) => setRdvJour(e.target.value)} />
              <Saisie type="time" step={300} aria-label="Heure du rendez-vous" value={rdvHeure} onChange={(e) => setRdvHeure(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <Zone rows={2} placeholder="Ce qui a été dit, prochaine étape…" aria-label="Commentaire" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
      {resultat !== 'ne_pas_rappeler' && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-doux">
            <CalendarClock className="size-4" aria-hidden /> Prochaine relance
          </div>
          <RelanceChoix
            valeur={relance}
            onChange={(iso) => {
              setRelance(iso)
              setRelanceManuelle(true)
            }}
          />
        </div>
      )}
      <div className="sticky bottom-0 flex gap-2 bg-surface pt-1">
        <button type="button" onClick={fermer} className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl`}>
          Plus tard
        </button>
        <button type="button" disabled={!resultat || occupe} onClick={enregistrer} className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}>
          {occupe ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

/**
 * À placer une fois dans l'application : au retour après un appel ou un message,
 * propose immédiatement de noter le résultat et la prochaine relance.
 */
export function RetourAction() {
  const action = useActionEnCours()
  const contact = useLiveQuery(async () => (action?.contactId ? ((await contacts.get(action.contactId)) ?? null) : null), [action?.contactId])
  const piste = useLiveQuery(async () => (action?.pisteId ? ((await pistes.get(action.pisteId)) ?? null) : null), [action?.pisteId])
  const bien = useLiveQuery(async () => (piste ? ((await biens.get(piste.bienId)) ?? null) : null), [piste?.bienId])

  useEffect(() => {
    const visible = () => document.visibilityState === 'visible' && surRetour()
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', visible)
    surRetour() // application rechargée pendant l'appel (fréquent sur iPhone)
    return () => {
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('focus', visible)
    }
  }, [])

  if (!action?.afficher || contact === undefined || piste === undefined || (piste && bien === undefined)) return null
  if (!contact && !piste) return null
  const nom = piste && bien ? adresseCourte(bien) : contact ? nomAffiche(contact) : ''
  return (
    <Feuille titre={`${TITRE[action.canal]} · ${nom}`} ouverte fermer={terminerAction}>
      <SaisieResultat key={action.lanceeLe} contact={contact} piste={piste} canal={action.canal} numero={action.numero} fermer={terminerAction} />
    </Feuille>
  )
}

/** Menu de contact ouvert depuis une liste (bouton téléphone d'une ligne). */
export function MenuContactGlobal() {
  const menu = useMenuContact()
  const contact = useLiveQuery(() => (menu ? contacts.get(menu.contactId) : undefined), [menu?.contactId])
  if (!menu || !contact) return null
  return <MenuContact contact={contact} numero={menu.numero} pisteId={menu.pisteId} ouvert fermer={fermerMenuContact} />
}
