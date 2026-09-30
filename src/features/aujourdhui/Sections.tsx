import { AlarmClockOff, Phone, Trophy } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { confirmer } from '@/components/ui/Confirmation'
import { contacts } from '@/data/repositories/contacts'
import type { Contact } from '@/data/types'
import { depuisDateLocale, versDateLocale } from '@/domain/dates'
import type { Priorite } from '@/domain/priorite'
import { dateRelance, DELAIS_RELANCE } from '@/domain/relance'
import { ouvrirMenuContact } from '@/features/actions/actions'
import { initiales, nomAffiche } from '@/features/contacts/affichage'
import type { ContactColore } from '@/features/contacts/filtres'

function BoutonAppel({ contact }: { contact: Contact }) {
  if (contact._telNorm.length === 0 && contact.emails.length === 0) return null
  return (
    <button
      type="button"
      onClick={() => ouvrirMenuContact(contact.id)}
      className="presse grid size-11 shrink-0 place-items-center rounded-full bg-primaire-doux text-primaire-texte"
      aria-label={`Contacter ${nomAffiche(contact)}`}
    >
      <Phone className="size-5" aria-hidden />
    </button>
  )
}

/** « Qui appeler en premier » : le classement du jour, avec la raison de chaque rang. */
export function TopAppels({ lignes }: { lignes: (ContactColore & { priorite: Priorite })[] }) {
  if (lignes.length === 0) return null
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <Trophy className="size-5 text-primaire-texte" aria-hidden />
        <h2 className="text-base font-bold">Qui appeler en premier</h2>
      </div>
      <p className="px-4 text-xs text-doux">Classés selon vos chances de réussite : positif, chaud, tout juste repéré, retard…</p>
      <ol className="mt-1 pb-1">
        {lignes.map(({ contact, couleur, priorite }, i) => (
          <li key={contact.id} className="flex items-center gap-2 py-2 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
            <span className="w-5 shrink-0 text-center text-sm font-extrabold text-doux tabular-nums">{i + 1}</span>
            <Link to={`/contacts/${contact.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
              <Avatar initiales={initiales(contact)} cle={contact.id} couleur={couleur} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{nomAffiche(contact)}</span>
                <span className="line-clamp-2 text-xs leading-snug text-doux">{priorite.raisons.join(' · ')}</span>
              </span>
            </Link>
            <BoutonAppel contact={contact} />
          </li>
        ))}
      </ol>
    </Card>
  )
}

const RACCOURCIS = DELAIS_RELANCE.filter((d) => d.code !== '6m')

/** « Aucune piste sans prochaine action » : chaque fiche active doit avoir une relance datée. */
export function SansAction({ lignes }: { lignes: ContactColore[] }) {
  if (lignes.length === 0) return null

  const planifier = (c: Contact, code: (typeof RACCOURCIS)[number]['code']) =>
    contacts.modifier(c.id, { prochaineRelanceAt: depuisDateLocale(versDateLocale(dateRelance(code).toISOString())) })

  const nePlusSuivre = async (c: Contact) => {
    const ok = await confirmer({
      titre: `Ne plus suivre ${nomAffiche(c)} ?`,
      message: 'La fiche est archivée (jamais effacée). Vous pourrez la restaurer à tout moment.',
      confirmer: 'Archiver',
    })
    if (ok) await contacts.archiver(c.id)
  }

  return (
    <Card className="overflow-hidden !p-0 ring-2 ring-suivi-rouge/25">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <AlarmClockOff className="size-5 text-suivi-rouge" aria-hidden />
        <h2 className="text-base font-bold">Sans prochaine action</h2>
        <span className="rounded-full bg-suivi-rouge/12 px-2 py-0.5 text-xs font-bold text-suivi-rouge">{lignes.length}</span>
      </div>
      <p className="px-4 text-xs text-doux">Ces fiches n’ont aucune relance prévue : elles risquent d’être oubliées. Choisissez la suite en un appui.</p>
      <ul className="mt-2 pb-2">
        {lignes.slice(0, 8).map(({ contact, couleur }) => (
          <li key={contact.id} className="px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
            <div className="flex items-center gap-3">
              <Link to={`/contacts/${contact.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                <Avatar initiales={initiales(contact)} cle={contact.id} couleur={couleur} />
                <span className="truncate text-[15px] font-bold">{nomAffiche(contact)}</span>
              </Link>
              <BoutonAppel contact={contact} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
              {RACCOURCIS.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => planifier(contact, d.code)}
                  className="presse h-8 rounded-full bg-primaire-doux px-3 text-xs font-bold text-primaire-texte"
                >
                  {d.libelle}
                </button>
              ))}
              <button type="button" onClick={() => nePlusSuivre(contact)} className="presse h-8 rounded-full bg-surface-2 px-3 text-xs font-bold text-doux">
                Ne plus suivre
              </button>
            </div>
          </li>
        ))}
      </ul>
      {lignes.length > 8 && <p className="px-4 pb-4 text-xs font-semibold text-doux">… et {lignes.length - 8} autres (liste Contacts, tri « Prochaine relance »).</p>}
    </Card>
  )
}
