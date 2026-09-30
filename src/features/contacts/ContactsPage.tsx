import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, Plus, Search, Users, X } from 'lucide-react'
import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Puce } from '@/components/ui/Champ'
import { classesBouton } from '@/components/ui/Bouton'
import { ContactLigne, HAUTEUR_LIGNE } from './ContactLigne'
import { appliquerFiltre, FILTRES, rechercher, trier, TRIS, type FiltreRapide, type Tri } from './filtres'
import { useContactsColores } from './useContacts'

export default function ContactsPage() {
  const [params, setParams] = useSearchParams()
  const filtre = (params.get('filtre') as FiltreRapide | null) ?? 'tous'
  const tri = (params.get('tri') as Tri | null) ?? 'nom'
  const [requete, setRequete] = useState('')
  const requeteDiff = useDeferredValue(requete)
  const { liste, maintenant } = useContactsColores()

  const resultats = useMemo(
    () => (liste ? trier(rechercher(appliquerFiltre(liste, filtre, maintenant), requeteDiff), tri) : []),
    [liste, filtre, tri, requeteDiff, maintenant],
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

  const changerParam = (cle: string, valeur: string, defaut: string) => {
    const p = new URLSearchParams(params)
    if (valeur === defaut) p.delete(cle)
    else p.set(cle, valeur)
    setParams(p, { replace: true })
  }
  const choisirFiltre = (f: FiltreRapide) => changerParam('filtre', f, 'tous')

  return (
    <>
      <PageHeader
        titre="Contacts"
        sousTitre={liste ? `${resultats.length.toLocaleString('fr-BE')} sur ${liste.length.toLocaleString('fr-BE')}` : 'Chargement…'}
        action={
          <Link
            to="/contacts/nouveau"
            className={classesBouton('primaire')}
          >
            <Plus className="size-5" aria-hidden /> Nouveau
          </Link>
        }
      />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-fond px-4 pb-3 pt-1 lg:top-0 lg:mx-0 lg:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-doux" aria-hidden />
          <input
            type="search"
            inputMode="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Nom, téléphone, adresse, ville…"
            aria-label="Rechercher un contact"
            className="h-12 w-full rounded-2xl bg-surface pl-11 pr-10 text-base shadow-carte outline-none ring-1 ring-bord/60 transition focus:ring-4 focus:ring-primaire/20 dark:shadow-none"
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
        <div className="mt-3 flex items-center justify-end">
          <label className="relative flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-bold text-doux ring-1 ring-bord">
            <ArrowUpDown className="size-4" aria-hidden />
            <span className="sr-only">Trier par</span>
            <select
              value={tri}
              onChange={(e) => changerParam('tri', e.target.value, 'nom')}
              className="appearance-none bg-transparent pr-1 text-texte outline-none"
              aria-label="Trier par"
            >
              {TRIS.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="sans-barre -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
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
        <div ref={listeRef} className="mt-1 overflow-hidden rounded-3xl bg-surface py-1 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">
          <div style={{ height: virtualiseur.getTotalSize(), position: 'relative' }}>
            {virtualiseur.getVirtualItems().map((ligne) => {
              const { contact, couleur } = resultats[ligne.index]!
              return (
                <div
                  key={contact.id}
                  className={ligne.index < resultats.length - 1 ? 'after:absolute after:bottom-0 after:left-[72px] after:right-4 after:h-px after:bg-bord/70' : ''}
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
