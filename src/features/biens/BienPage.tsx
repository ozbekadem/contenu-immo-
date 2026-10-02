import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, ArrowLeft, Building2, DoorOpen, Eye, MapPin, Navigation, Pencil, Plus, Signpost } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PiecesJointes } from '@/components/PiecesJointes'
import { AjoutPhotos, Galerie } from '@/components/Photos'
import { Avatar } from '@/components/ui/Avatar'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { Feuille } from '@/components/ui/Feuille'
import { db } from '@/data/db'
import { biens } from '@/data/repositories/biens'
import { photos as depotPhotos } from '@/data/repositories/photos'
import { pistes } from '@/data/repositories/pistes'
import { TYPES_BIEN, type Adresse, type Bien, type TypeBien } from '@/data/types'
import { cpPourLocalite, localitesPourCp } from '@/domain/adresse'
import type { CategoriePiste } from '@/domain/prospection'
import { initiales } from '@/features/contacts/affichage'
import { liensItineraire } from '@/features/prospection/affichage'
import { PrixMarche } from '@/features/marche/PrixMarche'
import { PisteLigne } from '@/features/prospection/PisteLigne'
import { usePistes } from '@/features/prospection/usePistes'
import { COULEUR_ETAT, construireVues, etatBien, LIBELLE_ETAT, nomProprietaire } from './useBiens'

const Carte = lazy(() => import('@/components/Carte'))

const ADRESSE_VIDE: Adresse = { rue: '', numero: '', boite: '', cp: '', ville: '' }

function ModifierAdresse({ bien, fermer }: { bien: Bien; fermer: () => void }) {
  const [a, setA] = useState<Adresse>(bien.adresse ?? ADRESSE_VIDE)
  const maj = (champ: keyof Adresse, valeur: string) => {
    const suivante = { ...a, [champ]: valeur }
    // Code postal → localité (et inversement) pour la région de Charleroi
    if (champ === 'cp' && !a.ville) {
      const l = localitesPourCp(valeur)
      if (l.length === 1) suivante.ville = l[0]!
    }
    if (champ === 'ville' && !a.cp) suivante.cp = cpPourLocalite(valeur) ?? ''
    setA(suivante)
  }
  const enregistrer = async () => {
    const vide = !Object.values(a).some((v) => v.trim())
    await biens.modifier(bien.id, { adresse: vide ? null : a, adresseAChercher: false })
    fermer()
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Champ libelle="Rue">
          <Saisie value={a.rue} onChange={(e) => maj('rue', e.target.value)} autoCapitalize="words" />
        </Champ>
        <Champ libelle="Numéro">
          <Saisie value={a.numero} onChange={(e) => maj('numero', e.target.value)} />
        </Champ>
      </div>
      <div className="grid grid-cols-[6rem_1fr_5rem] gap-2">
        <Champ libelle="Code postal">
          <Saisie inputMode="numeric" value={a.cp} onChange={(e) => maj('cp', e.target.value)} />
        </Champ>
        <Champ libelle="Localité">
          <Saisie value={a.ville} onChange={(e) => maj('ville', e.target.value)} autoCapitalize="words" />
        </Champ>
        <Champ libelle="Boîte">
          <Saisie value={a.boite} onChange={(e) => maj('boite', e.target.value)} />
        </Champ>
      </div>
      <button type="button" onClick={enregistrer} className={`${classesBouton('primaire', 'lg')} mt-1 w-full`}>
        Enregistrer l’adresse
      </button>
    </div>
  )
}

function Caracteristiques({ bien }: { bien: Bien }) {
  const [notes, setNotes] = useState(bien.notes)
  useEffect(() => setNotes(bien.notes), [bien.notes])
  const choisir = <K extends 'type' | 'facades' | 'chambres'>(champ: K, valeur: Bien[K]) =>
    biens.modifier(bien.id, { [champ]: bien[champ] === valeur ? null : valeur } as Partial<Bien>)
  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle>Caractéristiques</SectionTitle>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-doux">Type</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type de bien">
          {TYPES_BIEN.map((t) => (
            <Puce key={t.code} actif={bien.type === t.code} onClick={() => choisir('type', t.code as TypeBien)}>
              {t.libelle}
            </Puce>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-[13px] font-semibold text-doux">Façades</p>
          <div className="flex gap-2" role="group" aria-label="Façades">
            {[2, 3, 4].map((n) => (
              <Puce key={n} actif={bien.facades === n} onClick={() => choisir('facades', n)}>
                {n}
              </Puce>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-doux">Chambres</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Chambres">
            {[1, 2, 3, 4, 5].map((n) => (
              <Puce key={n} actif={bien.chambres === n} onClick={() => choisir('chambres', n)}>
                {n === 5 ? '5+' : n}
              </Puce>
            ))}
          </div>
        </div>
      </div>
      <Champ libelle="Notes sur le bien">
        <Zone rows={3} value={notes} placeholder="État, travaux, jardin, garage…" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== bien.notes && biens.modifier(bien.id, { notes })} />
      </Champ>
    </Card>
  )
}

/** Fiche d'un bien : photos, adresse et position, caractéristiques, pistes, propriétaires et documents. */
export default function BienPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const bien = useLiveQuery(() => biens.get(id), [id], null)
  const pistesBien = useLiveQuery(() => pistes.duBien(id), [id])
  const listePhotos = useLiveQuery(() => depotPhotos.duBien(id), [id]) ?? []
  const proprietaires = useLiveQuery(async () => {
    const ids = [...new Set((pistesBien ?? []).filter((p) => !p.archivedAt && p.contactId).map((p) => p.contactId!))]
    return (await db.contacts.bulkGet(ids)).filter((c) => !!c && !c.archivedAt)
  }, [pistesBien])
  const { liste: vuesPistes, maintenant } = usePistes()
  const [adresseOuverte, setAdresseOuverte] = useState(false)
  const [corriger, setCorriger] = useState(false)

  const vue = useMemo(() => (bien && pistesBien ? construireVues([bien], pistesBien, [], new Map())[0] : null), [bien, pistesBien])
  const lignes = useMemo(() => (vuesPistes ?? []).filter((v) => v.piste.bienId === id && !v.piste.archivedAt), [vuesPistes, id])

  if (bien === null || pistesBien === undefined) return null
  if (!bien)
    return (
      <div className="py-16 text-center">
        <p className="text-doux">Ce bien n’existe pas (ou plus sur cet appareil).</p>
        <Link to="/biens" className="mt-4 inline-block font-semibold text-primaire-texte underline">
          Retour aux biens
        </Link>
      </div>
    )

  const etat = vue ? etatBien(vue) : 'aucune'
  const itineraire = liensItineraire(bien)
  const aPosition = bien.lat != null && bien.lng != null
  const demo = !!bien._demo
  const proprietairePrincipal = proprietaires?.[0] ?? null

  const nouvellePiste = async (categorie: CategoriePiste) => {
    const p = await pistes.creerDepuisTerrain(
      {
        categorie,
        source: categorie === 'annonce' ? 'affiche' : 'reperage',
        telephone: '',
        nomProprietaire: '',
        adresse: bien.adresse,
        position: null,
        adresseAChercher: false,
        typeBien: bien.type,
        prix: null,
        sourceUrl: null,
        indices: [],
        notes: '',
        photos: [],
        bienExistantId: bien.id,
        contactExistantId: proprietairePrincipal?.id ?? null,
      },
      { demo },
    )
    navigate(`/pistes/${p.id}`)
  }

  const basculerArchive = async () => {
    if (bien.archivedAt) return biens.restaurer(bien.id)
    const enCours = pistesBien.filter((p) => !p.archivedAt && p.statut !== 'gagne' && p.statut !== 'perdu')
    const ok = await confirmer({
      titre: 'Archiver ce bien ?',
      message: enCours.length
        ? `Ses ${enCours.length} piste(s) en cours seront aussi archivées. Rien n’est effacé : vous pourrez tout restaurer.`
        : 'Il disparaît des listes et de la carte, mais n’est jamais effacé.',
      confirmer: 'Archiver',
    })
    if (!ok) return
    for (const p of enCours) await pistes.archiver(p.id)
    await biens.archiver(bien.id)
  }

  const actives = new Set(lignes.filter((v) => v.piste.statut !== 'gagne' && v.piste.statut !== 'perdu').map((v) => v.piste.categorie))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="presse grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <AjoutPhotos bienId={bien.id} demo={demo} />
      </div>

      <Galerie liste={listePhotos} />

      <Card className="!p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
            <span className="size-2 rounded-full" style={{ background: COULEUR_ETAT[etat] }} aria-hidden />
            {LIBELLE_ETAT[etat]}
          </span>
          {demo && <span className="degrade rounded-full px-2.5 py-1 text-xs font-bold text-white">Démo</span>}
          {bien.archivedAt && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-doux">Archivé</span>}
        </div>
        <button type="button" onClick={() => setAdresseOuverte(true)} className="mt-2 flex w-full items-start gap-2 text-left">
          <span className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{vue?.titre}</h1>
            {bien.adresse?.cp && <span className="text-sm font-medium text-doux">{bien.adresse.cp}</span>}
          </span>
          <Pencil className="mt-2 size-4 shrink-0 text-doux" aria-label="Modifier l’adresse" />
        </button>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {itineraire ? (
            <a href={itineraire.google} target="_blank" rel="noopener noreferrer" className={`${classesBouton('primaire')} h-14 flex-col gap-0.5 rounded-2xl text-xs`}>
              <Navigation className="size-5" aria-hidden /> Itinéraire
            </a>
          ) : (
            <span />
          )}
          {itineraire ? (
            <a href={itineraire.waze} target="_blank" rel="noopener noreferrer" className={`${classesBouton('fantome')} h-14 flex-col gap-0.5 rounded-2xl text-xs`}>
              <Navigation className="size-5" aria-hidden /> Waze
            </a>
          ) : (
            <span />
          )}
          {aPosition ? (
            <a
              href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${bien.lat},${bien.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${classesBouton('fantome')} h-14 flex-col gap-0.5 rounded-2xl text-xs`}
            >
              <Eye className="size-5" aria-hidden /> Street View
            </a>
          ) : (
            <span />
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle
          action={
            <button type="button" onClick={() => setCorriger(!corriger)} className={`${classesBouton('fantome')} h-9 px-3 text-xs`}>
              <MapPin className="size-4" aria-hidden /> {corriger ? 'Terminé' : aPosition ? 'Corriger' : 'Placer'}
            </button>
          }
        >
          Position
        </SectionTitle>
        {corriger && <p className="-mt-1 mb-2 text-xs font-semibold text-primaire-texte">Faites glisser le point, ou touchez la carte à l’endroit exact du bien.</p>}
        {aPosition || corriger ? (
          <Suspense fallback={<div className="h-56 animate-pulse rounded-3xl bg-surface-2" />}>
            <Carte
              className="h-56"
              zoom={17}
              points={aPosition ? [{ id: bien.id, lat: bien.lat!, lng: bien.lng!, couleur: COULEUR_ETAT[etat], titre: vue?.titre ?? '' }] : []}
              deplacer={corriger ? (p) => void biens.modifier(bien.id, { lat: p.lat, lng: p.lng, precisionGps: null }) : undefined}
            />
          </Suspense>
        ) : (
          <p className="text-sm text-doux">Pas de position GPS. Touchez « Placer » pour l’indiquer sur la carte.</p>
        )}
        {bien.precisionGps != null && !corriger && <p className="mt-2 text-xs text-doux">Position GPS prise sur place (± {bien.precisionGps} m).</p>}
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="px-4 pt-4">
          <SectionTitle>Pistes</SectionTitle>
        </div>
        {lignes.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-doux">Aucune piste sur ce bien.</p>
        ) : (
          <div className="[&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-bord/60">
            {lignes.map((v) => (
              <PisteLigne key={v.piste.id} vue={v} maintenant={maintenant} />
            ))}
          </div>
        )}
        {(!actives.has('annonce') || !actives.has('maison_vide')) && !bien.archivedAt && (
          <div className="flex flex-wrap gap-2 px-4 pb-4 pt-2">
            {!actives.has('annonce') && (
              <button type="button" onClick={() => nouvellePiste('annonce')} className={`${classesBouton('fantome')} h-10 px-3 text-xs`}>
                <Plus className="size-4" aria-hidden />
                <Signpost className="size-4 text-annonce" aria-hidden /> Nouvelle annonce
              </button>
            )}
            {!actives.has('maison_vide') && (
              <button type="button" onClick={() => nouvellePiste('maison_vide')} className={`${classesBouton('fantome')} h-10 px-3 text-xs`}>
                <Plus className="size-4" aria-hidden />
                <DoorOpen className="size-4 text-maison-vide" aria-hidden /> Maison vide
              </button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Propriétaires connus</SectionTitle>
        {proprietaires?.length ? (
          <ul className="flex flex-col gap-1">
            {proprietaires.map((c) => (
              <li key={c!.id}>
                <Link to={`/contacts/${c!.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl p-2 active:bg-surface-2">
                  <Avatar initiales={initiales(c!)} cle={c!.id} />
                  <span className="truncate font-bold">{nomProprietaire(c!)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-doux">Encore inconnu. Ajoutez-le depuis une piste (« Ajouter le propriétaire »).</p>
        )}
      </Card>

      <Caracteristiques bien={bien} />
      <PrixMarche bien={bien} prix={vue?.active?.categorie === 'annonce' ? vue.active.prix : null} />
      <PiecesJointes entite="biens" entiteId={bien.id} />

      <button type="button" onClick={basculerArchive} className={`${classesBouton('fantome')} mt-2 w-full text-doux`}>
        {bien.archivedAt ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {bien.archivedAt ? 'Restaurer le bien' : 'Archiver le bien'}
      </button>
      <p className="-mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-doux">
        <Building2 className="size-3.5" aria-hidden /> Fiche créée le {new Date(bien.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <Feuille titre="Adresse du bien" ouverte={adresseOuverte} fermer={() => setAdresseOuverte(false)}>
        {adresseOuverte && <ModifierAdresse bien={bien} fermer={() => setAdresseOuverte(false)} />}
      </Feuille>
    </div>
  )
}
