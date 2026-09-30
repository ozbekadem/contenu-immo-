import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronRight, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { contacts, type DonneesContact } from '@/data/repositories/contacts'
import type { Contact } from '@/data/types'
import { empreinte, LIBELLE_RAISON, trouverSimilaires, type Candidat } from '@/domain/doublons'
import { initiales, nomAffiche } from './affichage'

/** Fiches existantes qui ressemblent à la saisie en cours (mise à jour en direct). */
export function useFichesSimilaires(saisie: DonneesContact | null, exclureId?: string): Candidat<Contact>[] {
  const tous = useLiveQuery(() => contacts.tous(), [])
  const index = useMemo(() => tous?.map((c) => ({ fiche: c, empreinte: c._empreinte ?? empreinte(c) })), [tous])
  const s = useDeferredValue(saisie)
  return useMemo(() => {
    if (!index || !s) return []
    return trouverSimilaires(empreinte(s), index, exclureId)
  }, [index, s, exclureId])
}

/** Encart « Fiches similaires » : signalement uniquement, jamais de fusion automatique. */
export function FichesSimilaires({ candidats }: { candidats: Candidat<Contact>[] }) {
  const [ecartes, setEcartes] = useState<Set<string>>(new Set())
  const visibles = candidats.filter((c) => !ecartes.has(c.fiche.id))
  if (visibles.length === 0) return null

  return (
    <div id="fiches-similaires" role="alert" className="animate-apparition scroll-mt-20 rounded-3xl bg-suivi-orange/10 p-4 ring-1 ring-suivi-orange/30">
      <div className="flex items-center gap-2 font-bold text-suivi-orange">
        <AlertTriangle className="size-5" aria-hidden />
        {visibles.length === 1 ? 'Cette fiche existe peut-être déjà' : `${visibles.length} fiches existantes se ressemblent`}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {visibles.map(({ fiche, raisons }) => (
          <li key={fiche.id} className="flex items-center gap-2 rounded-2xl bg-surface p-2 pl-3 shadow-carte dark:shadow-none">
            <Link to={`/contacts/${fiche.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar initiales={initiales(fiche)} cle={fiche.id} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {nomAffiche(fiche)}
                  {fiche.archivedAt && <span className="font-medium text-doux"> (archivé)</span>}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {raisons.map((r) => (
                    <span key={r} className="rounded-full bg-suivi-orange/12 px-2 py-0.5 text-[11px] font-bold text-suivi-orange">
                      {LIBELLE_RAISON[r]}
                    </span>
                  ))}
                  {fiche.adresse?.ville && <span className="text-xs text-doux">{fiche.adresse.ville}</span>}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-doux" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setEcartes(new Set([...ecartes, fiche.id]))}
              className="grid size-10 shrink-0 place-items-center rounded-full text-doux"
              aria-label={`${nomAffiche(fiche)} est une autre personne`}
              title="C’est une autre personne"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-doux">Ouvrez la fiche existante pour la compléter, ou touchez ✕ si c’est une autre personne. Rien n’est fusionné automatiquement.</p>
    </div>
  )
}
