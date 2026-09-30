import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Plus, Search, Users, X } from 'lucide-react'
import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Puce } from '@/components/ui/Champ'
import { ContactLigne, HAUTEUR_LIGNE } from './ContactLigne'
import { appliquerFiltre, FILTRES, rechercher, type FiltreRapide } from './filtres'
import { useContactsColores } from './useContacts'

export default function ContactsPage() {
  const [params, setParams] = useSearchParams()
  const filtre = (params.get('filtre') as FiltreRapide | null) ?? 'tous'
  const [requete, setRequete] = useState('')
  const requeteDiff = useDeferredValue(requete)
  const { liste, maintenant } = useContactsColores()

  const resultats = useMemo(
    () => (liste ? rechercher(appliquerFiltre(liste, filtre, maintenant), requeteDiff) : []),
    [liste, filtre, requeteDiff, maintenant],
  )

  const listeRef = useRef<HTMLDivElement>(null)
  const [decalage, setDecalage] = useState(0)
  useLayoutEffect(() => {
    setDecalage(listeRef.current?.offsetTop ?? 0)
  }, [liste === undefined])

  const virtualiseur = useWindowVirtualizer({
    count: resultats.length,
    estimateSize: () => HAUTEUR_LIGNE,
    overscan: 8,
    scrollMargin: decalage,
  })

  const choisirFiltre = (f: FiltreRapide) => setParams(f === 'tous' ? {} : { filtre: f }, { replace: true })

  return (
    <>
      <PageHeader
        titre="Contacts"
        sousTitre={liste ? `${resultats.length.toLocaleString('fr-BE')} sur ${liste.length.toLocaleString('fr-BE')}` : 'Chargement…'}
        action={
          <Link
            to="/contacts/nouveau"
            className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 font-semibold text-accent dark:bg-accent dark:text-accent-ink"
          >
            <Plus className="size-5" aria-hidden /> Nouveau
          </Link>
        }
      />

      <div className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-10 -mx-4 bg-fond px-4 pb-2 pt-2 lg:top-0 lg:mx-0 lg:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-doux" aria-hidden />
          <input
            type="search"
            inputMode="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Nom, téléphone, adresse, ville…"
            aria-label="Rechercher un contact"
            className="h-12 w-full rounded-2xl border border-bord bg-surface pl-10 pr-10 text-base outline-none focus:border-texte"
          />
          {requete && (
            <button
              type="button"
              onClick={() => setRequete('')}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-doux"
              aria-label="Effacer la recherche"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
          {FILTRES.map((f) => (
            <Puce key={f.code} actif={filtre === f.code} onClick={() => choisirFiltre(f.code)}>
              {f.libelle}
            </Puce>
          ))}
        </div>
      </div>

      {liste && resultats.length === 0 ? (
        <div className="mt-4">
          <EmptyState icone={Users} titre={liste.length === 0 ? 'Aucun contact' : 'Aucun résultat'}>
            {liste.length === 0 ? 'Ajoutez votre premier contact avec le bouton « Nouveau ».' : 'Essayez un autre mot ou un autre filtre.'}
          </EmptyState>
        </div>
      ) : (
        <div ref={listeRef} className="-mx-4 mt-2 overflow-hidden border-t border-bord bg-surface lg:mx-0 lg:rounded-2xl lg:border">
          <div style={{ height: virtualiseur.getTotalSize(), position: 'relative' }}>
            {virtualiseur.getVirtualItems().map((ligne) => {
              const { contact, couleur } = resultats[ligne.index]!
              return (
                <div
                  key={contact.id}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${ligne.start - decalage}px)` }}
                >
                  <ContactLigne contact={contact} couleur={couleur} maintenant={maintenant} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
