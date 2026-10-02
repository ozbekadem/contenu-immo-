import { useLiveQuery } from 'dexie-react-hooks'
import { Inbox, Link2, MapPin, Phone, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, EnteteSection } from '@/components/ui/Card'
import { Feuille } from '@/components/ui/Feuille'
import { db } from '@/data/db'
import type { DonneesContact } from '@/data/repositories/contacts'
import { evenements } from '@/data/repositories/evenements'
import type { Evenement } from '@/data/types'
import { extraireCoordonnees, type Coordonnees } from '@/domain/estimations'
import { formaterTelephone } from '@/domain/telephone'
import { nomAffiche } from '@/features/contacts/affichage'
import { ChoixContact } from './FormulaireEvenement'

const QUAND = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Ce que le formulaire « Nouveau contact » reçoit pour être pré-rempli. */
export interface PreRemplissageContact {
  contact: Partial<DonneesContact>
  /** Rendez-vous à rattacher à la fiche une fois enregistrée. */
  evenementId: string
}

function preRemplissage(e: Evenement, c: Coordonnees): PreRemplissageContact {
  return {
    evenementId: e.id,
    contact: {
      civilite: c.civilite,
      prenom: c.prenom,
      nom: c.nom,
      telephones: c.telephones.length ? c.telephones.map((numero) => ({ numero: formaterTelephone(numero) })) : [{ numero: '' }],
      emails: c.email ? [c.email] : [],
      adresse: c.adresse,
      statuts: ['prospect_vendeur'],
      source: 'appel_entrant',
      notes: [e.notes, `Demande d’estimation reçue via Google Agenda : « ${e.titre} »`].filter(Boolean).join('\n\n'),
    },
  }
}

function Ligne({ e }: { e: Evenement }) {
  const navigate = useNavigate()
  const [autre, setAutre] = useState(false)
  const c = extraireCoordonnees(e.titre, e.notes, e.lieu)
  const connus = useLiveQuery(async () => {
    if (!c.telephones.length && !c.email) return []
    const parTel = c.telephones.length ? await db.contacts.where('_telNorm').anyOf(c.telephones).toArray() : []
    const parEmail = c.email ? await db.contacts.filter((x) => x.emails.some((m) => m.toLowerCase() === c.email)).toArray() : []
    return [...new Map([...parTel, ...parEmail].filter((x) => !x.archivedAt).map((x) => [x.id, x])).values()]
  }, [c.telephones.join(), c.email])
  const relier = (contactId: string | null) => contactId && void evenements.modifier(e.id, { contactId, aEncoder: false })

  return (
    <li className="px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
      <p className="text-xs font-bold uppercase tracking-wide text-primaire-texte">{e.journee ? new Date(e.debut).toLocaleDateString('fr-BE') : QUAND.format(new Date(e.debut))}</p>
      <p className="mt-0.5 text-[15px] font-bold leading-snug">{e.titre}</p>
      <div className="mt-1 flex flex-col gap-0.5 text-xs text-doux">
        {c.telephones.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <Phone className="size-3.5" aria-hidden /> {formaterTelephone(t)}
          </span>
        ))}
        {(c.adresse || e.lieu) && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden /> {c.adresse ? [`${c.adresse.rue} ${c.adresse.numero}`, [c.adresse.cp, c.adresse.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') : e.lieu}
          </span>
        )}
      </div>
      {connus?.map((x) => (
        <div key={x.id} className="mt-2 flex items-center gap-2 rounded-2xl bg-suivi-orange/10 p-2.5 text-sm">
          <span className="min-w-0 flex-1 truncate">
            Déjà connu : <strong>{nomAffiche(x)}</strong>
          </span>
          <button type="button" onClick={() => relier(x.id)} className={`${classesBouton('primaire')} h-9 shrink-0 px-3 text-xs`}>
            Relier
          </button>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigate('/contacts/nouveau', { state: { estimation: preRemplissage(e, c) } })} className={`${classesBouton(connus?.length ? 'secondaire' : 'primaire')} h-10 px-3 text-xs`}>
          <UserPlus className="size-4" aria-hidden /> Créer la fiche
        </button>
        <button type="button" onClick={() => setAutre(true)} className={`${classesBouton('secondaire')} h-10 px-3 text-xs`}>
          <Link2 className="size-4" aria-hidden /> Relier à une fiche
        </button>
        <button type="button" onClick={() => void evenements.modifier(e.id, { aEncoder: false })} className={`${classesBouton('fantome')} h-10 px-3 text-xs text-doux`}>
          Ignorer
        </button>
      </div>
      <Feuille titre="Relier à une fiche existante" ouverte={autre} fermer={() => setAutre(false)}>
        {autre && (
          <ChoixContact
            contactId={null}
            choisir={(id) => {
              relier(id)
              setAutre(false)
            }}
          />
        )}
      </Feuille>
    </li>
  )
}

/** « À encoder » : estimations notées par le secrétariat dans Google Agenda, pas encore reliées à une fiche. */
export function AEncoder() {
  const liste = useLiveQuery(() => db.evenements.filter((e) => !!e.aEncoder && !e.archivedAt).sortBy('debut'), [])
  if (!liste?.length) return null
  return (
    <Card className="overflow-hidden !p-0 ring-2 ring-primaire/25">
      <EnteteSection icone={Inbox} titre="À encoder" nombre={liste.length} description="Estimations notées dans Google Agenda. Créez la fiche (déjà pré-remplie) ou reliez-la à un contact existant." />
      <ul className="mt-1">
        {liste.map((e) => (
          <Ligne key={e.id} e={e} />
        ))}
      </ul>
    </Card>
  )
}
