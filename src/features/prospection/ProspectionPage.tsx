import { useLiveQuery } from 'dexie-react-hooks'
import { Briefcase, DoorOpen, LocateFixed, Phone, Search, Signpost, X, type LucideIcon } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { VignetteBien } from '@/components/Photos'
import { classesBouton } from '@/components/ui/Bouton'
import { Puce } from '@/components/ui/Champ'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { RelancePill } from '@/components/ui/RelancePill'
import { StatusDot } from '@/components/ui/StatusDot'
import { db } from '@/data/db'
import { SOURCES_CONTACT } from '@/data/types'
import { ecartJours } from '@/domain/dates'
import { distanceLisible, distanceMetres, LIBELLE_STATUT, prixLisible, type CategoriePiste, type StatutPiste } from '@/domain/prospection'
import { correspond, construireIndex, preparerRequete } from '@/domain/recherche'
import { ouvrirMenuContact } from '@/features/actions/actions'
import { nomAffiche } from '@/features/contacts/affichage'
import { ContactLigne } from '@/features/contacts/ContactLigne'
import { useContactsColores } from '@/features/contacts/useContacts'
import { positionActuelle, type Position } from '@/services/geocodage'
import { usePistes, type PisteVue } from './usePistes'

type Onglet = CategoriePiste | 'portefeuille'
type Filtre = 'actives' | 'appeler' | 'semaine' | 'gagne' | 'perdu'
type Tri = 'relance' | 'recent' | 'distance'

const ONGLETS: { code: Onglet; libelle: string; icone: LucideIcon; couleur: string }[] = [
  { code: 'annonce', libelle: 'Annonces', icone: Signpost, couleur: 'bg-annonce' },
  { code: 'maison_vide', libelle: 'Maisons vides', icone: DoorOpen, couleur: 'bg-maison-vide' },
  { code: 'portefeuille', libelle: 'Portefeuille', icone: Briefcase, couleur: 'bg-portefeuille' },
]

const FILTRES: { code: Filtre; libelle: string }[] = [
  { code: 'actives', libelle: 'En cours' },
  { code: 'appeler', libelle: 'À appeler' },
  { code: 'semaine', libelle: 'Cette semaine' },
  { code: 'gagne', libelle: 'Signés' },
  { code: 'perdu', libelle: 'Abandonnés' },
]

const ETAPES: StatutPiste[] = ['a_contacter', 'en_cours', 'rdv', 'gagne']

function filtrer(liste: PisteVue[], f: Filtre, maintenant: Date): PisteVue[] {
  const actives = liste.filter(({ piste }) => !piste.archivedAt && piste.statut !== 'perdu' && piste.statut !== 'gagne')
  switch (f) {
    case 'actives':
      return actives
    case 'appeler':
      return actives.filter((v) => v.couleur === 'rouge' || v.couleur === 'orange')
    case 'semaine':
      return actives.filter(({ piste }) => {
        const j = piste.prochaineRelanceAt ? ecartJours(maintenant, new Date(piste.prochaineRelanceAt)) : null
        return j !== null && j <= 7
      })
    case 'gagne':
      return liste.filter(({ piste }) => piste.statut === 'gagne')
    case 'perdu':
      return liste.filter(({ piste }) => piste.statut === 'perdu' || piste.archivedAt)
  }
}

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

function Portefeuille() {
  const { liste, maintenant } = useContactsColores()
  const contactsAvecPiste = useLiveQuery(async () => new Set((await db.pistes.toArray()).filter((p) => !p.archivedAt).map((p) => p.contactId)), [])
  const lignes = (liste ?? []).filter(({ contact }) => !contact.archivedAt && !contactsAvecPiste?.has(contact.id))
  if (lignes.length === 0)
    return (
      <EmptyState icone={Briefcase} titre="Portefeuille vide">
        Vos anciens clients et contacts à recontacter régulièrement apparaîtront ici.
      </EmptyState>
    )
  return (
    <>
      <p className="mb-2 text-sm text-doux">Contacts existants à recontacter régulièrement (hors annonces et maisons vides en cours).</p>
      <div className="overflow-hidden rounded-3xl bg-surface py-1 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-bord/60">
        {lignes.slice(0, 60).map(({ contact, couleur }) => (
          <ContactLigne key={contact.id} contact={contact} couleur={couleur} maintenant={maintenant} />
        ))}
      </div>
      {lignes.length > 60 && (
        <Link to="/contacts" className="mt-3 block text-center text-sm font-bold text-primaire-texte">
          Voir les {lignes.length} contacts
        </Link>
      )}
    </>
  )
}

export default function ProspectionPage() {
  const [params, setParams] = useSearchParams()
  const onglet = (params.get('categorie') as Onglet | null) ?? 'annonce'
  const [filtre, setFiltre] = useState<Filtre>('actives')
  const [tri, setTri] = useState<Tri>('relance')
  const [position, setPosition] = useState<Position | null>(null)
  const [erreurGps, setErreurGps] = useState<string | null>(null)
  const [requete, setRequete] = useState('')
  const requeteDiff = useDeferredValue(requete)
  const { liste, maintenant } = usePistes()

  const categorie = onglet === 'portefeuille' ? null : onglet
  const deCategorie = useMemo(() => (liste ?? []).filter((v) => v.piste.categorie === categorie), [liste, categorie])
  const compteParEtape = (s: StatutPiste) => deCategorie.filter((v) => v.piste.statut === s && !v.piste.archivedAt).length

  const resultats = useMemo(() => {
    let r = filtrer(deCategorie, filtre, maintenant)
    const jetons = preparerRequete(requeteDiff)
    if (jetons.length)
      r = r.filter((v) =>
        correspond(
          construireIndex([v.titre, v.bien?.adresse?.cp, v.contact && nomAffiche(v.contact), v.piste.notes, v.piste.sourceUrl], v.contact?._telNorm ?? []),
          jetons,
          v.contact?._rechPhon ?? '',
        ),
      )
    const distance = (v: PisteVue) =>
      position && v.bien?.lat != null ? distanceMetres(position, { lat: v.bien.lat, lng: v.bien.lng! }) : Number.POSITIVE_INFINITY
    return [...r].sort((a, b) => {
      if (tri === 'distance') return distance(a) - distance(b)
      if (tri === 'recent') return b.piste.createdAt.localeCompare(a.piste.createdAt)
      return (a.piste.prochaineRelanceAt ?? '9999').localeCompare(b.piste.prochaineRelanceAt ?? '9999')
    })
  }, [deCategorie, filtre, maintenant, requeteDiff, tri, position])

  const autourDeMoi = async () => {
    setErreurGps(null)
    try {
      setPosition(await positionActuelle())
      setTri('distance')
    } catch (e) {
      setErreurGps((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        titre="Prospection"
        sousTitre={liste ? `${liste.filter((v) => !v.piste.archivedAt && v.piste.statut !== 'perdu').length} pistes suivies` : 'Chargement…'}
      />

      <div className="grid grid-cols-3 gap-2" role="tablist">
        {ONGLETS.map(({ code, libelle, icone: Icone, couleur }) => {
          const actif = onglet === code
          const n = code === 'portefeuille' ? null : (liste ?? []).filter((v) => v.piste.categorie === code && !v.piste.archivedAt && v.piste.statut !== 'perdu').length
          return (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setParams(code === 'annonce' ? {} : { categorie: code }, { replace: true })}
              className={`presse flex flex-col items-center gap-1 rounded-2xl px-1 py-3 text-xs font-extrabold transition ${actif ? `${couleur} text-white shadow-carte` : 'bg-surface text-doux ring-1 ring-bord'}`}
            >
              <Icone className="size-5" aria-hidden />
              {libelle}
              {n !== null && <span className={`text-[11px] ${actif ? 'text-white/85' : ''}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      {onglet === 'portefeuille' ? (
        <div className="mt-4">
          <Portefeuille />
        </div>
      ) : (
        <>
          {/* Entonnoir : Repéré → Appelé → RDV/Visite → Signé */}
          <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-3xl bg-surface p-2 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">
            {ETAPES.map((s, i) => (
              <div key={s} className={`rounded-2xl px-1 py-2 text-center ${s === 'gagne' ? 'bg-suivi-vert/12 text-suivi-vert' : 'bg-surface-2'}`}>
                <div className="text-xl font-extrabold tabular-nums">{compteParEtape(s)}</div>
                <div className="text-[10.5px] font-bold leading-tight">
                  {i > 0 && <span className="text-doux">→ </span>}
                  {s === 'rdv' ? (onglet === 'maison_vide' ? 'Visite' : 'RDV') : LIBELLE_STATUT[s]}
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-doux" aria-hidden />
            <input
              type="search"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Adresse, propriétaire, téléphone…"
              aria-label="Rechercher une piste"
              className="h-12 w-full rounded-2xl bg-surface pl-11 pr-10 text-base shadow-carte outline-none ring-1 ring-bord/60 focus:ring-4 focus:ring-primaire/20 dark:shadow-none"
            />
            {requete && (
              <button type="button" onClick={() => setRequete('')} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-doux" aria-label="Effacer">
                <X className="size-5" />
              </button>
            )}
          </div>
          <div className="sans-barre -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {FILTRES.map((f) => (
              <Puce key={f.code} actif={filtre === f.code} onClick={() => setFiltre(f.code)}>
                {f.libelle}
              </Puce>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <select
              value={tri}
              onChange={(e) => (e.target.value === 'distance' ? void autourDeMoi() : setTri(e.target.value as Tri))}
              aria-label="Trier par"
              className="h-9 rounded-full bg-surface px-3 text-[13px] font-bold ring-1 ring-bord"
            >
              <option value="relance">Prochaine relance</option>
              <option value="recent">Repérés récemment</option>
              <option value="distance">Autour de moi</option>
            </select>
            <button type="button" onClick={autourDeMoi} className={`${classesBouton('fantome')} h-9 px-3 text-xs`}>
              <LocateFixed className="size-4" aria-hidden /> Autour de moi
            </button>
          </div>
          {erreurGps && <p className="mt-2 text-xs font-semibold text-suivi-rouge">{erreurGps}</p>}

          <div className="mt-3">
            {liste && resultats.length === 0 ? (
              <EmptyState icone={onglet === 'annonce' ? Signpost : DoorOpen} titre={deCategorie.length === 0 ? 'Rien de repéré pour l’instant' : 'Aucune piste'}>
                {deCategorie.length === 0 ? 'Touchez « Repérer » pour ajouter une affiche, une annonce ou une maison vide.' : 'Essayez un autre filtre.'}
              </EmptyState>
            ) : (
              <div className="overflow-hidden rounded-3xl bg-surface py-1 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-bord/60">
                {resultats.map((v) => (
                  <PisteLigne
                    key={v.piste.id}
                    vue={v}
                    maintenant={maintenant}
                    distance={tri === 'distance' && position && v.bien?.lat != null ? distanceMetres(position, { lat: v.bien.lat, lng: v.bien.lng! }) : null}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
