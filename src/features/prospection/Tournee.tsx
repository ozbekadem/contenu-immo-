import { ArrowDown, DoorOpen, LocateFixed, Navigation, Plus, Route, Signpost, Trash2, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import type { PointTournee } from '@/components/CarteTournee'
import { distanceLisible, LIBELLE_STATUT } from '@/domain/prospection'
import { dureeLisible, lienGoogleTournee, MAX_ETAPES_GOOGLE, ordreOptimise, resumeTournee, trajets, trajetLisible, type PointGeo } from '@/domain/tournee'
import { nomAffiche } from '@/features/contacts/affichage'
import type { PisteVue } from './usePistes'

const CarteTournee = lazy(() => import('@/components/CarteTournee'))

const COULEUR: Record<string, string> = {
  annonce: '#ff7a1a',
  maison_vide: '#9b51e0',
}
const CLE = 'prospection.tournee'

function lire(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLE) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function proprietaire(v: PisteVue): string | undefined {
  const nom = v.contact ? nomAffiche(v.contact) : null
  if (nom && nom !== v.titre) return nom
  return v.piste.categorie === 'maison_vide' && !v.contact ? 'Propriétaire inconnu' : undefined
}

function enPoint(v: PisteVue): PointTournee | null {
  if (v.bien?.lat == null || v.bien.lng == null) return null
  return {
    id: v.piste.id,
    lat: v.bien.lat,
    lng: v.bien.lng,
    couleur: COULEUR[v.piste.categorie] ?? '#2f6bff',
    titre: v.titre,
    sousTitre: proprietaire(v),
    etiquette: LIBELLE_STATUT[v.piste.statut],
    lien: `/pistes/${v.piste.id}`,
  }
}

/**
 * Prospection → Tournée : on touche les adresses une à une (sur la carte ou dans la liste) ;
 * elles se relient dans l'ordre sur la carte, avec la durée de chaque trajet. La tournée reste
 * en mémoire le temps de la journée (on peut ouvrir une fiche et revenir), puis s'ouvre dans Google Maps.
 */
export function Tournee({
  toutes,
  visibles,
  position,
  demanderPosition,
}: {
  /** Toutes les pistes (une tournée peut mêler annonces et maisons vides). */
  toutes: PisteVue[]
  /** Pistes de l'onglet et du filtre en cours : celles que l'on peut ajouter. */
  visibles: PisteVue[]
  position: PointGeo | null
  demanderPosition: () => void
}) {
  const navigate = useNavigate()
  const [selection, setSelection] = useState<string[]>(lire)
  const [focus, setFocus] = useState<string | null>(() => lire().at(-1) ?? null)

  useEffect(() => {
    try {
      sessionStorage.setItem(CLE, JSON.stringify(selection))
    } catch {
      /* navigation privée : la tournée n'est simplement pas gardée */
    }
  }, [selection])

  const parId = useMemo(() => new Map(toutes.map((v) => [v.piste.id, v])), [toutes])
  const etapes = useMemo(
    () =>
      selection
        .map((id) => parId.get(id))
        .map((v) => (v ? enPoint(v) : null))
        .filter((p): p is PointTournee => !!p),
    [selection, parId],
  )
  const candidats = useMemo(() => visibles.map(enPoint).filter((p): p is PointTournee => !!p), [visibles])
  const sansPosition = visibles.length - candidats.length
  const dansTournee = new Set(etapes.map((e) => e.id))
  const aAjouter = visibles.filter((v) => !dansTournee.has(v.piste.id) && v.bien?.lat != null)
  const t = trajets(etapes, position)
  const decalage = position ? 0 : 1 // sans départ, la 1re étape n'a pas de trajet
  const resume = resumeTournee(etapes, position)
  const lien = lienGoogleTournee(etapes, position)

  const ajouter = (id: string) => {
    setSelection((s) => (s.includes(id) ? s : [...s, id]))
    setFocus(id)
  }
  const retirer = (id: string) => {
    setSelection((s) => s.filter((x) => x !== id))
    setFocus((f) => (f === id ? null : f))
  }
  const optimiser = () => {
    const ordre = ordreOptimise(etapes, position)
    setSelection(ordre.map((e) => e.id))
    setFocus(ordre[0]?.id ?? null)
  }

  return (
    <div className="mt-3">
      <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-10 -mx-1 rounded-[28px] bg-fond px-1 pb-2 lg:top-3">
        <Suspense fallback={<div className="h-[44dvh] min-h-72 animate-pulse rounded-3xl bg-surface-2" />}>
          <CarteTournee
            candidats={candidats}
            etapes={etapes}
            focus={focus}
            position={position}
            ajouter={ajouter}
            choisir={setFocus}
            ouvrir={(l) => navigate(l)}
            className="h-[44dvh] min-h-72"
          />
        </Suspense>
      </div>

      {/* Résumé et actions */}
      <section className="mt-1 rounded-3xl bg-surface p-4 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Votre tournée">
        <div>
          <h2 className="text-base font-extrabold">Votre tournée</h2>
          {etapes.length > 0 && (
            <span className="block text-[13px] font-semibold text-doux">
              {resume.etapes} adresse{resume.etapes > 1 ? 's' : ''}
              {resume.metres > 0 && ` · ${distanceLisible(resume.metres)} · ≈ ${dureeLisible(resume.minutesVoiture)} en voiture`}
            </span>
          )}
        </div>

        {etapes.length === 0 ? (
          <p className="mt-1 text-sm text-doux">Touchez les adresses sur la carte ou dans la liste ci-dessous : elles se relient dans l’ordre où vous les choisissez.</p>
        ) : (
          <ol className="mt-3">
            {etapes.map((e, i) => {
              const tr = t[i - decalage]
              const v = parId.get(e.id)!
              return (
                <li key={e.id}>
                  {tr && (
                    <div className="flex items-center gap-2 py-1 pl-[11px] text-[12px] font-semibold text-doux">
                      <ArrowDown className="size-3.5" aria-hidden />
                      {trajetLisible(tr)}
                      <span className="text-doux/70">· {distanceLisible(tr.metres)}</span>
                    </div>
                  )}
                  <div className={`flex items-center gap-3 rounded-2xl px-1 py-1.5 transition ${focus === e.id ? 'bg-surface-2' : ''}`}>
                    <button type="button" onClick={() => setFocus(e.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
                      <span className="grid size-[26px] shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: e.couleur }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-bold">{e.titre}</span>
                        <span className="block truncate text-[12px] text-doux">{[e.sousTitre, LIBELLE_STATUT[v.piste.statut]].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => retirer(e.id)}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-doux active:bg-surface-2"
                      aria-label={`Retirer ${e.titre} de la tournée`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {!position && (
            <button type="button" onClick={demanderPosition} className={`${classesBouton('fantome')} h-10 px-3 text-xs`}>
              <LocateFixed className="size-4" aria-hidden /> Partir de ma position
            </button>
          )}
          {etapes.length >= 2 && (
            <button type="button" onClick={optimiser} className={`${classesBouton('fantome')} h-10 px-3 text-xs`}>
              <Route className="size-4" aria-hidden /> Meilleur ordre
            </button>
          )}
          {etapes.length > 0 && (
            <button type="button" onClick={() => (setSelection([]), setFocus(null))} className={`${classesBouton('fantome')} h-10 px-3 text-xs`}>
              <Trash2 className="size-4" aria-hidden /> Vider
            </button>
          )}
        </div>
        {lien && (
          <a href={lien} target="_blank" rel="noopener" className={`${classesBouton('primaire')} mt-3 w-full`}>
            <Navigation className="size-4" aria-hidden /> Lancer dans Google Maps
          </a>
        )}
        {etapes.length > MAX_ETAPES_GOOGLE && (
          <p className="mt-2 text-xs text-doux">Google Maps ne prend que les {MAX_ETAPES_GOOGLE} premières adresses d’un coup : relancez-le pour la suite.</p>
        )}
        {etapes.length > 0 && <p className="mt-2 text-[11px] text-doux">Durées estimées à vol d’oiseau, corrigées pour les rues : Google Maps donne le temps exact.</p>}
      </section>

      {/* Adresses à ajouter */}
      <h2 className="mb-2 mt-5 px-1 text-sm font-extrabold text-doux">Ajouter à la tournée</h2>
      {aAjouter.length === 0 ? (
        <p className="px-1 text-sm text-doux">{visibles.length === 0 ? 'Aucune piste avec ce filtre.' : 'Toutes les adresses de cette liste sont dans la tournée.'}</p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-surface py-1 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord [&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-bord/60">
          {aAjouter.map((v) => {
            const Icone = v.piste.categorie === 'annonce' ? Signpost : DoorOpen
            const depuis = etapes.at(-1) ?? position
            return (
              <button
                key={v.piste.id}
                type="button"
                onClick={() => ajouter(v.piste.id)}
                className="flex w-full items-center gap-3 py-2.5 pl-3 pr-3 text-left active:bg-surface-2"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-2xl ${v.piste.categorie === 'annonce' ? 'bg-annonce/15 text-annonce' : 'bg-maison-vide/15 text-maison-vide'}`}
                >
                  <Icone className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold">{v.titre}</span>
                  <span className="block truncate text-[12px] text-doux">
                    {[proprietaire(v), LIBELLE_STATUT[v.piste.statut], depuis ? trajetLisible(trajets([{ lat: v.bien!.lat!, lng: v.bien!.lng! }], depuis)[0]!) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primaire-doux text-primaire-texte">
                  <Plus className="size-5" aria-hidden />
                </span>
              </button>
            )
          })}
        </div>
      )}
      {sansPosition > 0 && (
        <p className="mt-2 px-1 text-xs text-doux">
          {sansPosition} piste{sansPosition > 1 ? 's' : ''} sans position GPS {sansPosition > 1 ? 'ne sont' : 'n’est'} pas sur la carte (corrigez la position depuis la
          fiche du bien).
        </p>
      )}
    </div>
  )
}
