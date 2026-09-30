import { Flame, Phone, Snowflake, Thermometer } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { RelancePill } from '@/components/ui/RelancePill'
import type { Contact } from '@/data/types'
import type { Couleur, Temperature } from '@/domain/relance'
import { libelleDernierContact } from '@/domain/relance'
import { ouvrirMenuContact } from '@/features/actions/actions'
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
  const joignable = !contact.nePasContacter && !contact.archivedAt && (contact._telNorm.length > 0 || contact.emails.length > 0)
  return (
    <div style={{ height: HAUTEUR_LIGNE }} className="flex items-center gap-2 pl-4 pr-2">
      <Link to={`/contacts/${contact.id}`} className="flex h-full min-w-0 flex-1 items-center gap-3 transition-colors active:opacity-70">
        <Avatar initiales={initiales(contact)} cle={contact.id} couleur={couleur} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate text-[15px] font-bold ${contact.archivedAt ? 'text-doux line-through' : ''}`}>{nomAffiche(contact)}</span>
            {temp && <temp.Icone className={`size-3.5 shrink-0 ${temp.cls}`} aria-label={temp.libelle} />}
          </div>
          <div className="truncate text-[13px] text-doux">
            {[contact.adresse?.ville, dernier ? `contacté ${libelleDernierContact(dernier, maintenant)}` : 'jamais contacté'].filter(Boolean).join(' · ')}
          </div>
        </div>
        <RelancePill couleur={couleur} relance={relance} maintenant={maintenant} />
      </Link>
      {joignable ? (
        <button
          type="button"
          onClick={() => ouvrirMenuContact(contact.id)}
          className="presse grid size-11 shrink-0 place-items-center rounded-full bg-primaire-doux text-primaire-texte"
          aria-label={`Contacter ${nomAffiche(contact)}`}
        >
          <Phone className="size-5" aria-hidden />
        </button>
      ) : (
        <span className="size-11 shrink-0" />
      )}
    </div>
  )
})
