import { Building2, Camera, List, LocateFixed, Map as IconeCarte, Search, X } from 'lucide-react'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { VignetteBien } from '@/components/Photos'
import { classesBouton } from '@/components/ui/Bouton'
import { Puce } from '@/components/ui/Champ'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { TYPES_BIEN } from '@/data/types'
import { distanceLisible, distanceMetres } from '@/domain/prospection'
import { construireIndex, correspond, preparerRequete } from '@/domain/recherche'
import { nomAffiche } from '@/features/contacts/affichage'
import { positionActuelle, type Position } from '@/services/geocodage'
import { COULEUR_ETAT, etatBien, LIBELLE_ETAT, nomProprietaire, useBiens, type BienVue, type EtatBien } from './useBiens'

// La carte (Leaflet) n'est chargée que si on l'ouvre.
const Carte = lazy(() => import('@/components/Carte'))

type Filtre = 'tous' | EtatBien
const FILTRES: { code: Filtre; libelle: string }[] = [
  { code: 'tous', libelle: 'Tous' },
  { code: 'annonce', libelle: 'Annonces' },
  { code: 'maison_vide', libelle: 'Maisons vides' },
  { code: 'signe', libelle: 'Signés' },
  { code: 'aucune', libelle: 'Sans piste' },
]

function BienLigne({ v, distance }: { v: BienVue; distance: number | null }) {
  const etat = etatBien(v)
  const type = TYPES_BIEN.find((t) => t.code === v.bien.type)?.libelle
  const details = [type, v.bien.chambres ? `${v.bien.chambres} ch.` : null, v.bien.facades ? `${v.bien.facades} façades` : null].filter(Boolean).join(' · ')
  return (
    <Link to={`/biens/${v.bien.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
      <span className="relative isolate size-14 shrink-0">
        <VignetteBien bienId={v.bien.id} className="size-14 rounded-2xl object-cover" />
        <span className="absolute inset-0 -z-10 grid place-items-center rounded-2xl bg-surface-2 text-doux">
          <Building2 className="size-6" aria-hidden />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{v.titre}</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="size-2 shrink-0 rounded-full" style={{ background: COULEUR_ETAT[etat] }} aria-hidden />
          <span className="truncate">{LIBELLE_ETAT[etat]}</span>
          {distance !== null && <span className="shrink-0 text-doux">· {distanceLisible(distance)}</span>}
        </span>
        <span className="block truncate text-xs text-doux">
          {[details, v.proprietaires.map(nomProprietaire).join(', ') || 'Propriétaire inconnu'].filter(Boolean).join(' · ')}
        </span>
      </span>
      {v.nbPhotos > 0 && (
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-doux">
          <Camera className="size-3.5" aria-hidden /> {v.nbPhotos}
        </span>
      )}
    </Link>
  )
}

/** Biens : une fiche par maison (photos, pistes, propriétaires, documents), en liste ou sur la carte. */
export default function BiensPage() {
  const liste = useBiens()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const vueCarte = params.get('vue') === 'carte'
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [requete, setRequete] = useState('')
  const requeteDiff = useDeferredValue(requete)
  const [position, setPosition] = useState<Position | null>(null)
  const [erreurGps, setErreurGps] = useState<string | null>(null)

  const resultats = useMemo(() => {
    let r = (liste ?? []).filter((v) => filtre === 'tous' || etatBien(v) === filtre)
    const jetons = preparerRequete(requeteDiff)
    if (jetons.length)
      r = r.filter((v) =>
        correspond(
          construireIndex([v.titre, v.bien.adresse?.cp, v.bien.notes, ...v.proprietaires.map(nomAffiche)], v.proprietaires.flatMap((c) => c._telNorm)),
          jetons,
          v.proprietaires.map((c) => c._rechPhon).join(' '),
        ),
      )
    if (position) {
      const d = (v: BienVue) => (v.bien.lat != null ? distanceMetres(position, { lat: v.bien.lat, lng: v.bien.lng! }) : Number.POSITIVE_INFINITY)
      r = [...r].sort((a, b) => d(a) - d(b))
    }
    return r
  }, [liste, filtre, requeteDiff, position])

  const points = useMemo(
    () =>
      resultats
        .filter((v) => v.bien.lat != null && v.bien.lng != null)
        .map((v) => ({
          id: v.bien.id,
          lat: v.bien.lat!,
          lng: v.bien.lng!,
          couleur: COULEUR_ETAT[etatBien(v)],
          titre: v.titre,
          sousTitre: LIBELLE_ETAT[etatBien(v)],
          lien: `/biens/${v.bien.id}`,
        })),
    [resultats],
  )
  const sansPosition = resultats.length - points.length

  const autourDeMoi = async () => {
    setErreurGps(null)
    try {
      setPosition(await positionActuelle())
    } catch (e) {
      setErreurGps((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader titre="Biens" sousTitre={liste ? `${liste.length} bien${liste.length > 1 ? 's' : ''} repéré${liste.length > 1 ? 's' : ''}` : 'Chargement…'} />

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Affichage">
        {[
          { carte: false, libelle: 'Liste', icone: List },
          { carte: true, libelle: 'Carte', icone: IconeCarte },
        ].map(({ carte, libelle, icone: Icone }) => (
          <button
            key={libelle}
            type="button"
            role="tab"
            aria-selected={vueCarte === carte}
            onClick={() => setParams(carte ? { vue: 'carte' } : {}, { replace: true })}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${vueCarte === carte ? 'bg-surface text-primaire-texte shadow-carte' : 'text-doux'}`}
          >
            <Icone className="size-4" aria-hidden /> {libelle}
          </button>
        ))}
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-doux" aria-hidden />
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Adresse, code postal, propriétaire…"
          aria-label="Rechercher un bien"
          className="h-12 w-full rounded-2xl bg-surface pl-11 pr-10 text-base shadow-carte outline-none ring-1 ring-bord/60 focus:ring-4 focus:ring-primaire/20 dark:shadow-none"
        />
        {requete && (
          <button type="button" onClick={() => setRequete('')} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-doux" aria-label="Effacer">
            <X className="size-5" />
          </button>
        )}
      </div>
      <div className="sans-barre -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTRES.map((f) => (
          <Puce key={f.code} actif={filtre === f.code} onClick={() => setFiltre(f.code)}>
            {f.code !== 'tous' && <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: COULEUR_ETAT[f.code] }} aria-hidden />}
            {f.libelle}
          </Puce>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end">
        <button type="button" onClick={autourDeMoi} className={`${classesBouton('fantome')} h-9 px-3 text-xs`}>
          <LocateFixed className="size-4" aria-hidden /> {position ? 'Position à jour' : 'Autour de moi'}
        </button>
      </div>
      {erreurGps && <p className="mt-1 text-xs font-semibold text-suivi-rouge">{erreurGps}</p>}

      <div className="mt-2">
        {liste && liste.length === 0 ? (
          <EmptyState icone={Building2} titre="Aucun bien pour l’instant">
            Chaque repérage (affiche, annonce, maison vide) crée la fiche du bien. Touchez « Repérer » pour commencer.
          </EmptyState>
        ) : vueCarte ? (
          <>
            <Suspense fallback={<div className="h-[62dvh] animate-pulse rounded-3xl bg-surface-2" />}>
              <Carte points={points} position={position} ouvrir={(lien) => navigate(lien)} className="h-[62dvh] min-h-80" />
            </Suspense>
            {sansPosition > 0 && (
              <p className="mt-2 text-center text-xs text-doux">
                {sansPosition} bien{sansPosition > 1 ? 's' : ''} sans position GPS (non affiché{sansPosition > 1 ? 's' : ''} sur la carte).
              </p>
            )}
          </>
        ) : resultats.length === 0 ? (
          <EmptyState icone={Search} titre="Aucun bien">
            Essayez un autre filtre ou une autre recherche.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-surface py-1 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord [&>a:not(:last-child)]:border-b [&>a:not(:last-child)]:border-bord/60">
            {resultats.map((v) => (
              <BienLigne key={v.bien.id} v={v} distance={position && v.bien.lat != null ? distanceMetres(position, { lat: v.bien.lat, lng: v.bien.lng! }) : null} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
