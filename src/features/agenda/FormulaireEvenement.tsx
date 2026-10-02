import { useLiveQuery } from 'dexie-react-hooks'
import { Navigation, Phone, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Champ, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { Feuille } from '@/components/ui/Feuille'
import { db } from '@/data/db'
import { titreEvenement } from '@/data/google/souhaites'
import { biens } from '@/data/repositories/biens'
import { contacts } from '@/data/repositories/contacts'
import { evenements, evenementVide } from '@/data/repositories/evenements'
import { TYPES_EVENEMENT, type Contact, type Evenement, type TypeEvenement } from '@/data/types'
import { construireIndex, correspond, preparerRequete } from '@/domain/recherche'
import { ouvrirMenuContact } from '@/features/actions/actions'
import { nomAffiche } from '@/features/contacts/affichage'
import { adresseCourte, liensItineraire } from '@/features/prospection/affichage'

const DUREES = [
  { minutes: 30, libelle: '30 min' },
  { minutes: 60, libelle: '1 h' },
  { minutes: 90, libelle: '1 h 30' },
  { minutes: 120, libelle: '2 h' },
]

const deuxChiffres = (n: number) => String(n).padStart(2, '0')
const jourLocal = (d: Date) => `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
const heureLocale = (d: Date) => `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`

/** Ce qu'on sait déjà au moment de créer le rendez-vous (depuis une fiche, une piste, un résultat d'appel). */
export interface PreRemplissage {
  type?: TypeEvenement
  debut?: Date
  contactId?: string | null
  pisteId?: string | null
  bienId?: string | null
}

/** Prochain créneau rond : demain 10 h. */
export function creneauParDefaut(maintenant = new Date()): Date {
  const d = new Date(maintenant)
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

export function ChoixContact({ contactId, choisir }: { contactId: string | null; choisir: (id: string | null) => void }) {
  const [requete, setRequete] = useState('')
  const choisi = useLiveQuery(async () => (contactId ? ((await contacts.get(contactId)) ?? null) : null), [contactId])
  const actif = requete.trim().length >= 2
  const tous = useLiveQuery(async (): Promise<Contact[]> => (actif ? db.contacts.filter((c) => !c.archivedAt).toArray() : []), [actif])
  const resultats = useMemo(() => {
    const jetons = preparerRequete(requete)
    if (!jetons.length || !tous) return []
    return tous.filter((c) => correspond(c._recherche || construireIndex([nomAffiche(c)]), jetons, c._rechPhon)).slice(0, 5)
  }, [tous, requete])

  if (choisi)
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-primaire-doux px-3 py-2.5 text-sm font-bold text-primaire-texte">
        <span className="flex-1 truncate">{nomAffiche(choisi)}</span>
        <button type="button" onClick={() => choisir(null)} aria-label="Retirer le contact" className="grid size-7 place-items-center rounded-full">
          <X className="size-4" />
        </button>
      </div>
    )
  return (
    <div className="flex flex-col gap-1">
      <Saisie placeholder="Nom, téléphone… (facultatif)" aria-label="Avec qui" value={requete} onChange={(e) => setRequete(e.target.value)} />
      {resultats.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            choisir(c.id)
            setRequete('')
          }}
          className="rounded-xl px-3 py-2 text-left text-sm font-semibold active:bg-surface-2"
        >
          {nomAffiche(c)}
        </button>
      ))}
    </div>
  )
}

function Formulaire({ existant, pre, fermer }: { existant: Evenement | null; pre: PreRemplissage; fermer: () => void }) {
  const debutInitial = existant ? new Date(existant.debut) : (pre.debut ?? creneauParDefaut())
  const dureeInitiale = existant ? Math.round((new Date(existant.fin).getTime() - new Date(existant.debut).getTime()) / 60_000) : 60
  const [type, setType] = useState<TypeEvenement>(existant?.type ?? pre.type ?? 'rdv')
  const [titre, setTitre] = useState(existant?.titre ?? '')
  const [jour, setJour] = useState(jourLocal(debutInitial))
  const [heure, setHeure] = useState(heureLocale(debutInitial))
  const [duree, setDuree] = useState(dureeInitiale)
  const [lieu, setLieu] = useState(existant?.lieu ?? '')
  const [notes, setNotes] = useState(existant?.notes ?? '')
  const [contactId, setContactId] = useState<string | null>(existant?.contactId ?? pre.contactId ?? null)
  const [occupe, setOccupe] = useState(false)
  const bienId = existant?.bienId ?? pre.bienId ?? null
  const bien = useLiveQuery(async () => (bienId ? ((await biens.get(bienId)) ?? null) : null), [bienId])
  const contact = useLiveQuery(async () => (contactId ? ((await contacts.get(contactId)) ?? null) : null), [contactId])
  const lieuParDefaut = bien ? adresseCourte(bien) : ''
  const itineraire = bien ? liensItineraire(bien) : null

  const enregistrer = async () => {
    const [a, m, j] = jour.split('-').map(Number)
    const [h, mi] = heure.split(':').map(Number)
    if (!a || !m || !j) return
    const debut = new Date(a, m - 1, j, h ?? 10, mi ?? 0)
    setOccupe(true)
    const donnees = {
      type,
      titre: titre.trim(),
      debut: debut.toISOString(),
      fin: new Date(debut.getTime() + duree * 60_000).toISOString(),
      journee: false,
      lieu: lieu.trim(),
      notes: notes.trim(),
      contactId,
    }
    if (existant) await evenements.modifier(existant.id, donnees)
    else {
      // Un rendez-vous sur une fiche de démonstration reste une donnée de démonstration (jamais envoyée).
      const parentDemo = !!(contact?._demo || bien?._demo)
      await evenements.creer({ ...evenementVide(debut), ...donnees, pisteId: pre.pisteId ?? null, bienId }, { demo: parentDemo })
    }
    setOccupe(false)
    fermer()
  }

  const supprimer = async () => {
    if (!existant) return
    const ok = await confirmer({ titre: 'Supprimer ce rendez-vous ?', message: 'Il disparaît de l’agenda et de Google Agenda. Il reste visible dans l’historique.', confirmer: 'Supprimer' })
    if (!ok) return
    await evenements.archiver(existant.id)
    fermer()
  }

  return (
    <div className="flex max-h-[78dvh] flex-col gap-4 overflow-y-auto pb-1">
      {existant && (contact || itineraire) && (
        <div className="flex gap-2">
          {contact && !contact.nePasContacter && contact._telNorm.length > 0 && (
            <button type="button" onClick={() => ouvrirMenuContact(contact.id, null, existant.pisteId)} className={`${classesBouton('secondaire')} h-11 flex-1 rounded-2xl`}>
              <Phone className="size-4" aria-hidden /> Contacter
            </button>
          )}
          {itineraire && (
            <a href={itineraire.google} target="_blank" rel="noopener noreferrer" className={`${classesBouton('secondaire')} h-11 flex-1 rounded-2xl`}>
              <Navigation className="size-4" aria-hidden /> Itinéraire
            </a>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Type">
        {TYPES_EVENEMENT.map((t) => (
          <Puce key={t.code} actif={type === t.code} onClick={() => setType(t.code)}>
            {t.libelle}
          </Puce>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <Champ libelle="Date">
          <Saisie type="date" value={jour} onChange={(e) => setJour(e.target.value)} required />
        </Champ>
        <Champ libelle="Heure">
          <Saisie type="time" step={300} value={heure} onChange={(e) => setHeure(e.target.value)} />
        </Champ>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Durée">
        {DUREES.map((d) => (
          <Puce key={d.minutes} actif={duree === d.minutes} onClick={() => setDuree(d.minutes)}>
            {d.libelle}
          </Puce>
        ))}
      </div>
      <Champ libelle="Avec qui">
        <ChoixContact contactId={contactId} choisir={setContactId} />
      </Champ>
      <Champ libelle="Titre (facultatif)">
        <Saisie
          value={titre}
          placeholder={titreEvenement({ ...evenementVide(new Date()), type, titre: '' } as Evenement, contact ?? null, bien ?? null)}
          onChange={(e) => setTitre(e.target.value)}
        />
      </Champ>
      <Champ libelle="Lieu (facultatif)">
        <Saisie value={lieu} placeholder={lieuParDefaut || 'Adresse du rendez-vous'} onChange={(e) => setLieu(e.target.value)} />
      </Champ>
      <Champ libelle="Notes (facultatif)">
        <Zone rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Champ>
      <div className="sticky bottom-0 flex gap-2 bg-surface pt-1">
        {existant && (
          <button type="button" onClick={supprimer} className={`${classesBouton('fantome')} h-12 w-12 shrink-0 rounded-2xl !px-0 text-suivi-rouge`} aria-label="Supprimer le rendez-vous">
            <Trash2 className="size-5" />
          </button>
        )}
        <button type="button" onClick={fermer} className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl`}>
          Annuler
        </button>
        <button type="button" disabled={occupe || !jour} onClick={enregistrer} className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}>
          {occupe ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

/** Fenêtre de création ou de modification d'un rendez-vous. */
export function FenetreEvenement({ ouverte, fermer, existant = null, pre = {} }: { ouverte: boolean; fermer: () => void; existant?: Evenement | null; pre?: PreRemplissage }) {
  return (
    <Feuille titre={existant ? 'Rendez-vous' : 'Nouveau rendez-vous'} ouverte={ouverte} fermer={fermer}>
      {ouverte && <Formulaire key={existant?.id ?? 'nouveau'} existant={existant} pre={pre} fermer={fermer} />}
    </Feuille>
  )
}
