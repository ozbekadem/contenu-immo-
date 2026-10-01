import { DoorOpen, Phone, Signpost } from 'lucide-react'
import { Link } from 'react-router'
import { VignetteBien } from '@/components/Photos'
import { RelancePill } from '@/components/ui/RelancePill'
import { StatusDot } from '@/components/ui/StatusDot'
import { SOURCES_CONTACT } from '@/data/types'
import { ecartJours } from '@/domain/dates'
import { distanceLisible, LIBELLE_STATUT, prixLisible } from '@/domain/prospection'
import { ouvrirMenuContact } from '@/features/actions/actions'
import { nomAffiche } from '@/features/contacts/affichage'
import type { PisteVue } from './usePistes'

/** Ligne de liste d'une piste (vignette, état, relance, bouton d'appel). */
export function PisteLigne({ vue, maintenant, distance }: { vue: PisteVue; maintenant: Date; distance?: number | null }) {
  const { piste, bien, contact, couleur, titre } = vue
  const source = SOURCES_CONTACT.find((s) => s.code === piste.source)?.libelle.replace(/ \(.*\)/, '')
  const depuis = piste.enVenteDepuis ? ecartJours(new Date(piste.enVenteDepuis), maintenant) : null
  const details = [
    contact ? nomAffiche(contact) : piste.categorie === 'maison_vide' ? 'propriétaire inconnu' : null,
    piste.prix ? prixLisible(piste.prix) : null,
    depuis !== null && depuis >= 30 ? `en vente depuis ${depuis} j` : source,
    piste.indices.length ? `${piste.indices.length} indice${piste.indices.length > 1 ? 's' : ''}` : null,
    distance != null ? distanceLisible(distance) : null,
  ].filter(Boolean)
  const joignable = contact && !contact.nePasContacter && (contact._telNorm.length > 0 || contact.emails.length > 0)
  return (
    <div className="flex items-center gap-2 py-2 pl-3 pr-2">
      <Link to={`/pistes/${piste.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
        <span className="relative isolate size-14 shrink-0">
          {bien ? <VignetteBien bienId={bien.id} className="size-14 rounded-2xl" /> : null}
          <span className={`absolute inset-0 -z-10 grid size-14 place-items-center rounded-2xl ${piste.categorie === 'annonce' ? 'bg-annonce/15 text-annonce' : 'bg-maison-vide/15 text-maison-vide'}`}>
            {piste.categorie === 'annonce' ? <Signpost className="size-6" /> : <DoorOpen className="size-6" />}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-[3px]">
            <StatusDot couleur={couleur} taille="sm" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{titre}</span>
          <span className="block truncate text-[13px] text-doux">{details.join(' · ')}</span>
          {piste.alerte ? (
            <span className="mt-0.5 inline-block rounded-full bg-suivi-rouge/12 px-2 py-0.5 text-[11px] font-bold text-suivi-rouge">{piste.alerte}</span>
          ) : (
            <span className="text-[11px] font-semibold text-doux">{LIBELLE_STATUT[piste.statut]}</span>
          )}
        </span>
        <RelancePill couleur={couleur} relance={piste.prochaineRelanceAt ? new Date(piste.prochaineRelanceAt) : null} maintenant={maintenant} />
      </Link>
      {joignable ? (
        <button
          type="button"
          onClick={() => ouvrirMenuContact(contact.id, null, piste.id)}
          className="presse grid size-11 shrink-0 place-items-center rounded-full bg-primaire-doux text-primaire-texte"
          aria-label={`Contacter le propriétaire de ${titre}`}
        >
          <Phone className="size-5" aria-hidden />
        </button>
      ) : (
        <span className="size-11 shrink-0" />
      )}
    </div>
  )
}
