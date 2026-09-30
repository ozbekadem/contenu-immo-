import { ChevronRight } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router'
import { TemperatureBadge } from '@/components/ui/Badges'
import { StatusDot } from '@/components/ui/StatusDot'
import type { Contact } from '@/data/types'
import type { Couleur } from '@/domain/relance'
import { libelleDernierContact, libelleProchaineRelance } from '@/domain/relance'
import { nomAffiche } from './affichage'

export const HAUTEUR_LIGNE = 76

const COULEUR_RELANCE: Partial<Record<Couleur, string>> = {
  rouge: 'text-suivi-rouge',
  orange: 'text-suivi-orange',
  jaune: 'text-texte',
}

/** Ligne de contact compacte, de hauteur fixe (listes virtualisées). */
export const ContactLigne = memo(function ContactLigne({
  contact,
  couleur,
  maintenant,
}: {
  contact: Contact
  couleur: Couleur
  maintenant: Date
}) {
  const relance = contact.prochaineRelanceAt ? new Date(contact.prochaineRelanceAt) : null
  const dernier = contact.dernierContactAt ? new Date(contact.dernierContactAt) : null
  return (
    <Link
      to={`/contacts/${contact.id}`}
      style={{ height: HAUTEUR_LIGNE }}
      className="flex items-center gap-3 border-b border-bord px-4 active:bg-surface-2"
    >
      <StatusDot couleur={couleur} taille="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate font-semibold ${contact.archivedAt ? 'text-doux line-through' : ''}`}>{nomAffiche(contact)}</span>
          {contact.temperature && <TemperatureBadge temperature={contact.temperature} />}
        </div>
        <div className="truncate text-xs text-doux">
          {contact.adresse?.ville || '—'} · Dernier contact : {libelleDernierContact(dernier, maintenant)}
        </div>
        <div className="truncate text-xs text-doux">
          Relance :{' '}
          <span className={`font-semibold ${COULEUR_RELANCE[couleur] ?? ''}`}>{libelleProchaineRelance(relance, maintenant)}</span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-doux" aria-hidden />
    </Link>
  )
})
