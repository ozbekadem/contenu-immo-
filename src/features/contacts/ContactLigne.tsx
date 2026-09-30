import { Flame, Snowflake, Thermometer } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { RelancePill } from '@/components/ui/RelancePill'
import type { Contact } from '@/data/types'
import type { Couleur, Temperature } from '@/domain/relance'
import { libelleDernierContact } from '@/domain/relance'
import { initiales, nomAffiche } from './affichage'

export const HAUTEUR_LIGNE = 72

const TEMP: Record<Temperature, { Icone: typeof Flame; cls: string; libelle: string }> = {
  chaud: { Icone: Flame, cls: 'text-chaud', libelle: 'Chaud' },
  tiede: { Icone: Thermometer, cls: 'text-tiede', libelle: 'Tiède' },
  froid: { Icone: Snowflake, cls: 'text-froid', libelle: 'Froid' },
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
  const temp = contact.temperature ? TEMP[contact.temperature] : null
  return (
    <Link
      to={`/contacts/${contact.id}`}
      style={{ height: HAUTEUR_LIGNE }}
      className="flex items-center gap-3 px-4 transition-colors active:bg-surface-2"
    >
      <Avatar initiales={initiales(contact)} cle={contact.id} couleur={couleur} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-[15px] font-bold ${contact.archivedAt ? 'text-doux line-through' : ''}`}>{nomAffiche(contact)}</span>
          {temp && <temp.Icone className={`size-3.5 shrink-0 ${temp.cls}`} aria-label={temp.libelle} />}
        </div>
        <div className="truncate text-[13px] text-doux">
          {[contact.adresse?.ville, `contact ${libelleDernierContact(dernier, maintenant)}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <RelancePill couleur={couleur} relance={relance} maintenant={maintenant} />
    </Link>
  )
})
