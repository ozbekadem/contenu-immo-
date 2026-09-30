import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  Cake,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PiecesJointes } from '@/components/PiecesJointes'
import { RelanceChoix } from '@/components/RelanceChoix'
import { Feuille } from '@/components/ui/Feuille'
import { ecartJours } from '@/domain/dates'
import { TemperatureBadge } from '@/components/ui/Badges'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { classesBouton } from '@/components/ui/Bouton'
import { RelancePill } from '@/components/ui/RelancePill'
import { contacts } from '@/data/repositories/contacts'
import type { Adresse, Contact, EntreeJournal } from '@/data/types'
import { LIBELLE_COULEUR, libelleDernierContact } from '@/domain/relance'
import {
  formaterTelephone,
  lienAppel,
  lienEmail,
  lienSms,
  lienWhatsapp,
  normaliserTelephone,
  ordreCanaux,
  type Canal,
} from '@/domain/telephone'
import { couleurContact, dateNaissanceLisible, initiales, libelleStatut, nomAffiche } from './affichage'
import { confirmer } from '@/components/ui/Confirmation'

type Onglet = 'identite' | 'documents' | 'biens' | 'prospection' | 'historique' | 'rappels' | 'rgpd' | 'journal'

const ONGLETS: { code: Onglet; libelle: string; etape?: number }[] = [
  { code: 'identite', libelle: 'Identité' },
  { code: 'documents', libelle: 'Documents et liens' },
  { code: 'biens', libelle: 'Biens et photos', etape: 7 },
  { code: 'prospection', libelle: 'Prospection', etape: 5 },
  { code: 'historique', libelle: 'Historique', etape: 4 },
  { code: 'rappels', libelle: 'Rappels', etape: 8 },
  { code: 'rgpd', libelle: 'RGPD', etape: 11 },
  { code: 'journal', libelle: 'Journal' },
]

const ACTIONS: Record<Canal, { libelle: string; icone: LucideIcon; classe: string }> = {
  appel: { libelle: 'Appeler', icone: Phone, classe: 'degrade text-white shadow-primaire' },
  whatsapp: { libelle: 'WhatsApp', icone: MessageCircle, classe: 'bg-whatsapp text-white shadow-[0_10px_24px_-8px_#25d366]' },
  sms: { libelle: 'SMS', icone: MessageSquare, classe: 'bg-primaire-doux text-primaire-texte' },
  email: { libelle: 'Email', icone: Mail, classe: 'bg-primaire-doux text-primaire-texte' },
}

function adresseLisible(a: Adresse): string {
  const rue = [a.rue, a.numero].filter(Boolean).join(' ') + (a.boite ? ` bte ${a.boite}` : '')
  return [rue, [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function BarreActions({ contact }: { contact: Contact }) {
  const tel = contact._telNorm[0]
  const email = contact.emails[0]
  const liens: Record<Canal, string | undefined> = {
    appel: tel && lienAppel(tel),
    whatsapp: tel && lienWhatsapp(tel),
    sms: tel && lienSms(tel),
    email: email && lienEmail(email),
  }
  const canaux = ordreCanaux(contact.utilisationCanaux, !!email).filter((c) => liens[c])
  if (canaux.length === 0) return null
  return (
    <div className="flex justify-center gap-5">
      {canaux.map((c) => {
        const { libelle, icone: Icone, classe } = ACTIONS[c]
        return (
          <a
            key={c}
            href={liens[c]}
            target={c === 'whatsapp' ? '_blank' : undefined}
            rel="noreferrer"
            className="presse flex w-16 flex-col items-center gap-1.5 text-xs font-bold"
          >
            <span className={`grid size-14 place-items-center rounded-full ${classe}`}>
              <Icone className="size-6" strokeWidth={2.2} aria-hidden />
            </span>
            {libelle}
          </a>
        )
      })}
    </div>
  )
}

function Ligne({ icone: Icone, children }: { icone: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primaire-doux text-primaire-texte">
        <Icone className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

function Identite({ contact }: { contact: Contact }) {
  const [voirAnciennes, setVoirAnciennes] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle>Coordonnées</SectionTitle>
        <ul className="divide-y divide-bord">
          {contact.telephones.map((t, i) => {
            const e164 = normaliserTelephone(t.numero)
            return (
              <Ligne key={i} icone={Phone}>
                {e164 ? (
                  <a href={lienAppel(e164)} className="font-semibold">
                    {formaterTelephone(t.numero)}
                  </a>
                ) : (
                  <span className="font-semibold">{t.numero}</span>
                )}
                {t.libelle && <span className="ml-2 text-xs text-doux">{t.libelle}</span>}
                {!e164 && <span className="block text-xs text-suivi-orange">Numéro non reconnu</span>}
              </Ligne>
            )
          })}
          {contact.emails.map((e) => (
            <Ligne key={e} icone={Mail}>
              <a href={lienEmail(e)} className="break-all font-semibold">
                {e}
              </a>
            </Ligne>
          ))}
          {contact.adresse && (
            <Ligne icone={MapPin}>
              <span>{adresseLisible(contact.adresse)}</span>
              {contact.anciennesAdresses.length > 0 && (
                <button type="button" className="block text-xs font-semibold text-doux underline" onClick={() => setVoirAnciennes((v) => !v)}>
                  {voirAnciennes ? 'Masquer' : 'Voir'} les anciennes adresses ({contact.anciennesAdresses.length})
                </button>
              )}
              {voirAnciennes && (
                <ul className="mt-1 space-y-1 text-xs text-doux">
                  {contact.anciennesAdresses.map((a, i) => (
                    <li key={i}>
                      {adresseLisible(a)} — jusqu’au {new Date(a.jusquau).toLocaleDateString('fr-BE')}
                    </li>
                  ))}
                </ul>
              )}
            </Ligne>
          )}
          {contact.dateNaissance && (
            <Ligne icone={Cake}>
              <span>{dateNaissanceLisible(contact.dateNaissance)}</span>
            </Ligne>
          )}
        </ul>
        {contact.telephones.length + contact.emails.length === 0 && !contact.adresse && (
          <p className="text-sm text-doux">Aucune coordonnée.</p>
        )}
      </Card>

      {(contact.tags.length > 0 || contact.notes) && (
        <Card>
          <SectionTitle>Notes</SectionTitle>
          {contact.tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {contact.tags.map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {contact.notes && <p className="whitespace-pre-wrap text-sm">{contact.notes}</p>}
        </Card>
      )}
    </div>
  )
}

const LIBELLES_CHAMPS: Record<string, string> = {
  creation: 'Fiche créée',
  archivedAt: 'Archivage',
  civilite: 'Civilité',
  prenom: 'Prénom',
  nom: 'Nom',
  societe: 'Société',
  telephones: 'Téléphones',
  emails: 'Emails',
  adresse: 'Adresse',
  anciennesAdresses: 'Anciennes adresses',
  dateNaissance: 'Date de naissance',
  statuts: 'Statuts',
  temperature: 'Température',
  canalPrefere: 'Canal préféré',
  tags: 'Tags',
  notes: 'Notes',
  nePasContacter: 'Ne pas contacter',
  prochaineRelanceAt: 'Prochaine relance',
  dernierContactAt: 'Dernier contact',
}

function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    return v.map((x) => (typeof x === 'object' && x ? ('numero' in x ? String(x.numero) : adresseLisible(x as Adresse)) : String(x))).join(', ')
  }
  if (typeof v === 'object') return adresseLisible(v as Adresse)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
  return String(v)
}

function Journal({ id }: { id: string }) {
  const entrees = useLiveQuery(() => contacts.journal(id), [id])
  if (!entrees) return null
  return (
    <Card>
      <SectionTitle>Journal des modifications</SectionTitle>
      <ol className="space-y-3">
        {entrees.map((e: EntreeJournal) => (
          <li key={e.id} className="text-sm">
            <div className="text-xs text-doux">
              {new Date(e.at).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
            {e.champ === 'creation' ? (
              <div className="font-semibold">Fiche créée</div>
            ) : e.champ === 'archivedAt' ? (
              <div className="font-semibold">{e.apres ? 'Fiche archivée' : 'Fiche restaurée'}</div>
            ) : (
              <div>
                <span className="font-semibold">{LIBELLES_CHAMPS[e.champ] ?? e.champ}</span> :{' '}
                <span className="text-doux line-through">{valeurLisible(e.avant)}</span> → {valeurLisible(e.apres)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

export default function ContactPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const contact = useLiveQuery(() => contacts.get(id), [id], null)
  const [onglet, setOnglet] = useState<Onglet>('identite')
  const [planifier, setPlanifier] = useState(false)

  if (contact === null) return null
  if (!contact)
    return (
      <div className="py-16 text-center">
        <p className="text-doux">Ce contact n’existe pas (ou plus sur cet appareil).</p>
        <Link to="/contacts" className="mt-4 inline-block font-semibold underline">
          Retour aux contacts
        </Link>
      </div>
    )

  const maintenant = new Date()
  const couleur = couleurContact(contact, maintenant)
  const ongletCourant = ONGLETS.find((o) => o.code === onglet)!

  const basculerArchive = async () => {
    if (contact.archivedAt) await contacts.restaurer(contact.id)
    else if (await confirmer({ titre: `Archiver ${nomAffiche(contact)} ?`, message: 'La fiche sera masquée des listes mais jamais effacée.', confirmer: 'Archiver' }))
      await contacts.archiver(contact.id)
  }

  const relance = contact.prochaineRelanceAt ? new Date(contact.prochaineRelanceAt) : null
  const contacteAujourdhui = !!contact.dernierContactAt && ecartJours(new Date(contact.dernierContactAt), maintenant) === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="presse grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <Link to={`/contacts/${contact.id}/modifier`} className={classesBouton('secondaire')}>
          <Pencil className="size-4" aria-hidden /> Modifier
        </Link>
      </div>

      {/* En-tête de la fiche */}
      <Card className="relative overflow-hidden !px-5 !pb-5 !pt-6 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primaire/20 via-primaire-2/10 to-transparent" />
        <div className="relative flex flex-col items-center">
          <Avatar initiales={initiales(contact)} cle={contact.id} couleur={couleur} taille="lg" />
          <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">
            {contact.civilite && <span className="font-semibold text-doux">{contact.civilite} </span>}
            {nomAffiche(contact)}
          </h1>
          {contact.societe && (contact.prenom || contact.nom) && <p className="text-sm font-medium text-doux">{contact.societe}</p>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {contact._demo && <span className="degrade rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white">Démo</span>}
            {contact.archivedAt && <span className="rounded-full bg-suivi-gris/20 px-2.5 py-0.5 text-[11px] font-bold">Archivé</span>}
            {contact.statuts.map((st) => (
              <span key={st} className="rounded-full bg-primaire-doux px-2.5 py-0.5 text-[11px] font-bold text-primaire-texte">
                {libelleStatut(st)}
              </span>
            ))}
            {contact.temperature && <TemperatureBadge temperature={contact.temperature} />}
          </div>

          {!contact.nePasContacter && !contact.archivedAt && (
            <div className="mt-5 w-full">
              <BarreActions contact={contact} />
            </div>
          )}
          {contact.nePasContacter && (
            <p className="mt-4 w-full rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">Ce contact ne souhaite pas être recontacté.</p>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 text-left">
          <div className="flex flex-col rounded-2xl bg-surface-2 p-3">
            <div className="text-xs font-semibold text-doux">Dernier contact</div>
            <div className="mt-0.5 font-bold">{libelleDernierContact(contact.dernierContactAt ? new Date(contact.dernierContactAt) : null, maintenant)}</div>
            {!contacteAujourdhui && (
              <button
                type="button"
                onClick={() => contacts.modifier(contact.id, { dernierContactAt: new Date().toISOString() })}
                className="mt-2 self-start rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-primaire-texte shadow-carte dark:shadow-none"
              >
                Contacté aujourd’hui
              </button>
            )}
          </div>
          <button type="button" onClick={() => setPlanifier(true)} className="presse flex flex-col items-start rounded-2xl bg-surface-2 p-3 text-left">
            <span className="text-xs font-semibold text-doux">Prochaine relance</span>
            <span className="mt-1" title={LIBELLE_COULEUR[couleur]}>
              <RelancePill couleur={couleur} relance={relance} maintenant={maintenant} />
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs font-bold text-primaire-texte">
              <CalendarClock className="size-3.5" aria-hidden /> Planifier
            </span>
          </button>
        </div>
      </Card>

      <nav className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Sections de la fiche">
        {ONGLETS.map((o) => (
          <button
            key={o.code}
            type="button"
            onClick={() => setOnglet(o.code)}
            aria-pressed={onglet === o.code}
            className={`presse h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
              onglet === o.code ? 'bg-texte text-surface' : 'bg-surface text-doux ring-1 ring-bord'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      <div key={onglet} className="animate-apparition">
        {onglet === 'identite' && <Identite contact={contact} />}
        {onglet === 'documents' && <PiecesJointes entite="contacts" entiteId={contact.id} />}
        {onglet === 'journal' && <Journal id={contact.id} />}
        {ongletCourant.etape && (
          <p className="rounded-3xl bg-surface p-8 text-center text-sm text-doux shadow-carte dark:shadow-none">
            Cette section arrive à l’étape {ongletCourant.etape}.
          </p>
        )}
      </div>

      <Feuille titre="Planifier une relance" ouverte={planifier} fermer={() => setPlanifier(false)}>
        <RelanceChoix
          valeur={contact.prochaineRelanceAt}
          onChange={async (iso) => {
            await contacts.modifier(contact.id, { prochaineRelanceAt: iso })
            setPlanifier(false)
          }}
        />
      </Feuille>

      <button type="button" onClick={basculerArchive} className={`${classesBouton('fantome')} mt-2 w-full text-doux`}>
        {contact.archivedAt ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {contact.archivedAt ? 'Restaurer la fiche' : 'Archiver la fiche'}
      </button>
    </div>
  )
}
