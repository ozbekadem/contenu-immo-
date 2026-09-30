import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
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
import { TemperatureBadge } from '@/components/ui/Badges'
import { Card, SectionTitle } from '@/components/ui/Card'
import { StatusDot } from '@/components/ui/StatusDot'
import { contacts } from '@/data/repositories/contacts'
import type { Adresse, Contact, EntreeJournal } from '@/data/types'
import { LIBELLE_COULEUR, libelleDernierContact, libelleProchaineRelance } from '@/domain/relance'
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

type Onglet = 'identite' | 'biens' | 'prospection' | 'historique' | 'rappels' | 'rgpd' | 'journal'

const ONGLETS: { code: Onglet; libelle: string; etape?: number }[] = [
  { code: 'identite', libelle: 'Identité' },
  { code: 'biens', libelle: 'Biens et photos', etape: 7 },
  { code: 'prospection', libelle: 'Prospection', etape: 5 },
  { code: 'historique', libelle: 'Historique', etape: 4 },
  { code: 'rappels', libelle: 'Rappels', etape: 8 },
  { code: 'rgpd', libelle: 'RGPD', etape: 11 },
  { code: 'journal', libelle: 'Journal' },
]

const ACTIONS: Record<Canal, { libelle: string; icone: LucideIcon; classe: string }> = {
  appel: { libelle: 'Appeler', icone: Phone, classe: 'bg-ink text-accent dark:bg-accent dark:text-accent-ink' },
  whatsapp: { libelle: 'WhatsApp', icone: MessageCircle, classe: 'bg-[#25D366] text-white' },
  sms: { libelle: 'SMS', icone: MessageSquare, classe: 'bg-surface-2 text-texte' },
  email: { libelle: 'Email', icone: Mail, classe: 'bg-surface-2 text-texte' },
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
    <div className="grid grid-flow-col auto-cols-fr gap-2">
      {canaux.map((c) => {
        const { libelle, icone: Icone, classe } = ACTIONS[c]
        return (
          <a
            key={c}
            href={liens[c]}
            target={c === 'whatsapp' ? '_blank' : undefined}
            rel="noreferrer"
            className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-transform active:scale-95 ${classe}`}
          >
            <Icone className="size-6" aria-hidden />
            {libelle}
          </a>
        )
      })}
    </div>
  )
}

function Ligne({ icone: Icone, children }: { icone: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <Icone className="mt-0.5 size-5 shrink-0 text-doux" aria-hidden />
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
}

function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    return v.map((x) => (typeof x === 'object' && x ? ('numero' in x ? String(x.numero) : adresseLisible(x as Adresse)) : String(x))).join(', ')
  }
  if (typeof v === 'object') return adresseLisible(v as Adresse)
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
    else if (confirm(`Archiver ${nomAffiche(contact)} ?\nLa fiche sera masquée des listes mais jamais effacée.`)) await contacts.archiver(contact.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <Link to={`/contacts/${contact.id}/modifier`} className="flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-semibold">
          <Pencil className="size-4" aria-hidden /> Modifier
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-accent text-xl font-extrabold text-accent-ink">
          {initiales(contact)}
          <span className="absolute -bottom-1 -right-1 rounded-full bg-fond p-1">
            <StatusDot couleur={couleur} />
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            {contact.civilite && <span className="font-semibold text-doux">{contact.civilite} </span>}
            {nomAffiche(contact)}
          </h1>
          {contact.societe && (contact.prenom || contact.nom) && <p className="text-sm text-doux">{contact.societe}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {contact._demo && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">Démo</span>}
            {contact.archivedAt && <span className="rounded-full bg-suivi-gris/20 px-2 py-0.5 text-[11px] font-bold">Archivé</span>}
            {contact.statuts.map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">
                {libelleStatut(s)}
              </span>
            ))}
            {contact.temperature && <TemperatureBadge temperature={contact.temperature} />}
          </div>
        </div>
      </div>

      {!contact.nePasContacter && !contact.archivedAt && <BarreActions contact={contact} />}
      {contact.nePasContacter && (
        <p className="rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">Ce contact ne souhaite pas être recontacté.</p>
      )}

      <Card className="grid grid-cols-2 gap-3 !p-3">
        <div>
          <div className="text-xs text-doux">Dernier contact</div>
          <div className="font-semibold">
            {libelleDernierContact(contact.dernierContactAt ? new Date(contact.dernierContactAt) : null, maintenant)}
          </div>
        </div>
        <div>
          <div className="text-xs text-doux">Prochaine relance</div>
          <div className="flex items-center gap-1.5 font-semibold">
            <StatusDot couleur={couleur} taille="sm" />
            <span title={LIBELLE_COULEUR[couleur]}>
              {libelleProchaineRelance(contact.prochaineRelanceAt ? new Date(contact.prochaineRelanceAt) : null, maintenant)}
            </span>
          </div>
        </div>
      </Card>

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-bord px-4 [scrollbar-width:none] lg:mx-0 lg:px-0" aria-label="Sections de la fiche">
        {ONGLETS.map((o) => (
          <button
            key={o.code}
            type="button"
            onClick={() => setOnglet(o.code)}
            className={`h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors ${
              onglet === o.code ? 'border-texte text-texte' : 'border-transparent text-doux'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      {onglet === 'identite' && <Identite contact={contact} />}
      {onglet === 'journal' && <Journal id={contact.id} />}
      {ongletCourant.etape && (
        <p className="rounded-2xl border border-dashed border-bord p-6 text-center text-sm text-doux">
          Cette section arrive à l’étape {ongletCourant.etape}.
        </p>
      )}

      <button
        type="button"
        onClick={basculerArchive}
        className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl border border-bord text-sm font-semibold text-doux"
      >
        {contact.archivedAt ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {contact.archivedAt ? 'Restaurer la fiche' : 'Archiver la fiche'}
      </button>
    </div>
  )
}
