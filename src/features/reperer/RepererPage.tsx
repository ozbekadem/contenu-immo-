import { AlertTriangle, Camera, Check, ImagePlus, LocateFixed, Loader2, MapPin, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { biens } from '@/data/repositories/biens'
import type { PhotoCompressee } from '@/data/repositories/photos'
import { contactsAvecTelephone, pistes, type SaisieTerrain } from '@/data/repositories/pistes'
import type { Adresse, Bien, Contact, Piste, SourceContact } from '@/data/types'
import { cpPourLocalite, localitesPourCp } from '@/domain/adresse'
import { normaliserUrl } from '@/domain/liens'
import { cleAnnonce, INDICES_INOCCUPATION, type CategoriePiste } from '@/domain/prospection'
import { normaliserTelephone } from '@/domain/telephone'
import { nomAffiche } from '@/features/contacts/affichage'
import { adresseCourte } from '@/features/prospection/affichage'
import { adresseDepuisPosition, positionActuelle, type Position } from '@/services/geocodage'
import { compresserPhoto } from '@/services/photos'

const SOURCES: Record<CategoriePiste, { code: SourceContact; libelle: string }[]> = {
  annonce: [
    { code: 'affiche', libelle: 'Affiche / panneau' },
    { code: 'immoweb', libelle: 'Immoweb' },
    { code: '2ememain', libelle: '2ememain' },
    { code: 'autre_site', libelle: 'Autre site' },
    { code: 'autre_agence', libelle: 'Autre agence' },
    { code: 'recommandation', libelle: 'Recommandation' },
  ],
  maison_vide: [
    { code: 'reperage', libelle: 'Repérage rue' },
    { code: 'recommandation', libelle: 'Voisin / recommandation' },
    { code: 'autre', libelle: 'Autre' },
  ],
}

interface PhotoEnCours {
  cle: string
  apercu: string
  compressee: PhotoCompressee | null
  erreur?: boolean
}

type EtatGps = { etat: 'recherche' } | { etat: 'ok'; position: Position } | { etat: 'erreur'; message: string }

const adresseVide = (): Adresse => ({ rue: '', numero: '', boite: '', cp: '', ville: '' })
const adresseRemplie = (a: Adresse) => Object.values(a).some((v) => v.trim())

export default function RepererPage() {
  const navigate = useNavigate()
  const [categorie, setCategorie] = useState<CategoriePiste>('annonce')
  const [source, setSource] = useState<SourceContact | null>('affiche')
  const [photos, setPhotos] = useState<PhotoEnCours[]>([])
  const [telephone, setTelephone] = useState('')
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState<Adresse>(adresseVide)
  const [adresseTouchee, setAdresseTouchee] = useState(false)
  const [gps, setGps] = useState<EtatGps>({ etat: 'recherche' })
  const [rechercheAdresse, setRechercheAdresse] = useState<'non' | 'en_cours' | 'plus_tard'>('non')
  const [lien, setLien] = useState('')
  const [prix, setPrix] = useState('')
  const [indices, setIndices] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [bienExistant, setBienExistant] = useState<Bien | null>(null)
  const [contactExistant, setContactExistant] = useState<Contact | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const appareil = useRef<HTMLInputElement>(null)
  const galerie = useRef<HTMLInputElement>(null)

  // ── Position GPS et adresse automatique dès l'ouverture ──
  const localiser = async () => {
    setGps({ etat: 'recherche' })
    try {
      const position = await positionActuelle()
      setGps({ etat: 'ok', position })
      if (!navigator.onLine) return setRechercheAdresse('plus_tard')
      setRechercheAdresse('en_cours')
      try {
        const trouvee = await adresseDepuisPosition(position)
        setRechercheAdresse('non')
        if (trouvee) setAdresse((a) => (adresseTouchee && adresseRemplie(a) ? a : trouvee))
      } catch {
        setRechercheAdresse('plus_tard')
      }
    } catch (e) {
      setGps({ etat: 'erreur', message: (e as Error).message })
    }
  }
  useEffect(() => {
    void localiser()
  }, [])

  // ── Photos : compressées dès qu'elles sont choisies (plusieurs à la fois) ──
  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return
    const nouvelles = Array.from(fichiers).map((f) => ({ fichier: f, cle: crypto.randomUUID(), apercu: URL.createObjectURL(f) }))
    setPhotos((p) => [...p, ...nouvelles.map(({ cle, apercu }) => ({ cle, apercu, compressee: null }))])
    for (const n of nouvelles) {
      try {
        const compressee = await compresserPhoto(n.fichier)
        setPhotos((p) => p.map((x) => (x.cle === n.cle ? { ...x, compressee } : x)))
      } catch {
        setPhotos((p) => p.map((x) => (x.cle === n.cle ? { ...x, erreur: true } : x)))
      }
    }
  }
  const retirerPhoto = (cle: string) =>
    setPhotos((p) => {
      const x = p.find((y) => y.cle === cle)
      if (x) URL.revokeObjectURL(x.apercu)
      return p.filter((y) => y.cle !== cle)
    })

  // ── Doublons : même téléphone, même bien (adresse ou < 25 m), même annonce ──
  const [telDoublons, setTelDoublons] = useState<Contact[]>([])
  const [bienDoublons, setBienDoublons] = useState<{ bien: Bien; raison: 'adresse' | 'proximite'; distance?: number }[]>([])
  const [annonceDoublons, setAnnonceDoublons] = useState<Piste[]>([])
  const position = gps.etat === 'ok' ? gps.position : null
  const url = normaliserUrl(lien)
  const cle = useMemo(() => cleAnnonce(url), [url])

  useEffect(() => {
    const t = setTimeout(async () => setTelDoublons(normaliserTelephone(telephone) ? await contactsAvecTelephone(telephone) : []), 200)
    return () => clearTimeout(t)
  }, [telephone])
  useEffect(() => {
    const t = setTimeout(async () => setBienDoublons(await biens.similaires(adresse, position)), 250)
    return () => clearTimeout(t)
  }, [adresse, position])
  useEffect(() => {
    let actif = true
    void (cle ? pistes.parAnnonce(cle) : Promise.resolve([])).then((r) => actif && setAnnonceDoublons(r))
    return () => {
      actif = false
    }
  }, [cle])

  const changerCategorie = (c: CategoriePiste) => {
    setCategorie(c)
    setSource(SOURCES[c][0]!.code)
  }

  const photosPretes = photos.every((p) => p.compressee || p.erreur)

  const enregistrer = async () => {
    if (enregistrement) return
    setErreur(null)
    setEnregistrement(true)
    try {
      const saisie: SaisieTerrain = {
        categorie,
        source,
        telephone: contactExistant ? '' : telephone,
        nomProprietaire: contactExistant ? '' : nom,
        adresse: adresseRemplie(adresse) ? adresse : null,
        position,
        adresseAChercher: !adresseRemplie(adresse) && !!position,
        typeBien: 'maison',
        prix: prix ? Number(prix.replace(/[^\d]/g, '')) || null : null,
        sourceUrl: url,
        indices: categorie === 'maison_vide' ? indices : [],
        notes,
        photos: photos.flatMap((p) => (p.compressee ? [p.compressee] : [])),
        bienExistantId: bienExistant?.id ?? null,
        contactExistantId: contactExistant?.id ?? null,
      }
      const piste = await pistes.creerDepuisTerrain(saisie)
      photos.forEach((p) => URL.revokeObjectURL(p.apercu))
      navigate(`/pistes/${piste.id}`, { replace: true, state: { nouveau: true } })
    } catch (e) {
      setErreur((e as Error).message)
      setEnregistrement(false)
    }
  }

  const localites = localitesPourCp(adresse.cp)

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Repérer</h1>
        <Link to="/" className="grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Fermer">
          <X className="size-5" />
        </Link>
      </div>

      {/* Photos */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => appareil.current?.click()} className={`${classesBouton('primaire', 'lg')} h-16`}>
          <Camera className="size-6" aria-hidden /> Photos
        </button>
        <button type="button" onClick={() => galerie.current?.click()} className={`${classesBouton('secondaire', 'lg')} h-16`}>
          <ImagePlus className="size-6" aria-hidden /> Galerie
        </button>
      </div>
      <input ref={appareil} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void ajouterPhotos(e.target.files).then(() => (e.target.value = ''))} />
      <input ref={galerie} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void ajouterPhotos(e.target.files).then(() => (e.target.value = ''))} />
      {photos.length > 0 && (
        <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4">
          {photos.map((p) => (
            <div key={p.cle} className="relative shrink-0">
              <img src={p.apercu} alt="" className="size-24 rounded-2xl object-cover" />
              {!p.compressee && !p.erreur && (
                <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/35 text-white">
                  <Loader2 className="size-6 animate-spin" aria-label="Compression" />
                </span>
              )}
              {p.erreur && <span className="absolute inset-x-1 bottom-1 rounded-lg bg-suivi-rouge px-1 text-center text-[10px] font-bold text-white">Illisible</span>}
              <button type="button" onClick={() => retirerPhoto(p.cle)} className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-texte text-surface shadow" aria-label="Retirer la photo">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Catégorie */}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Catégorie">
        {(
          [
            ['annonce', 'Annonce / affiche', 'bg-annonce'],
            ['maison_vide', 'Maison vide', 'bg-maison-vide'],
          ] as const
        ).map(([code, libelle, couleur]) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={categorie === code}
            onClick={() => changerCategorie(code)}
            className={`presse flex h-14 items-center justify-center gap-2 rounded-2xl text-sm font-extrabold transition ${
              categorie === code ? `${couleur} text-white shadow-carte` : 'bg-surface text-doux ring-1 ring-bord'
            }`}
          >
            {categorie === code && <Check className="size-4" aria-hidden />}
            {libelle}
          </button>
        ))}
      </div>
      <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4">
        {SOURCES[categorie].map((s) => (
          <Puce key={s.code} actif={source === s.code} onClick={() => setSource(s.code)}>
            {s.libelle}
          </Puce>
        ))}
      </div>

      {/* Téléphone */}
      <Card>
        <SectionTitle>{categorie === 'annonce' ? 'Numéro lu sur l’affiche ou l’annonce' : 'Propriétaire (si connu)'}</SectionTitle>
        {contactExistant ? (
          <div className="flex items-center gap-3 rounded-2xl bg-suivi-vert/10 p-3 text-sm">
            <Check className="size-5 text-suivi-vert" aria-hidden />
            <span className="flex-1">
              Relié à <strong>{nomAffiche(contactExistant)}</strong> (déjà connu)
            </span>
            <button type="button" onClick={() => setContactExistant(null)} className="text-xs font-bold text-doux underline">
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Saisie type="tel" inputMode="tel" placeholder="0476 12 34 56" aria-label="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            <Saisie placeholder="Nom (facultatif)" aria-label="Nom du propriétaire" value={nom} onChange={(e) => setNom(e.target.value)} autoCapitalize="words" />
            {telDoublons.length > 0 && (
              <div role="alert" className="rounded-2xl bg-suivi-orange/10 p-3 text-sm ring-1 ring-suivi-orange/30">
                <div className="flex items-center gap-2 font-bold text-suivi-orange">
                  <AlertTriangle className="size-4" aria-hidden /> Numéro déjà connu
                </div>
                {telDoublons.map((c) => (
                  <div key={c.id} className="mt-2 flex items-center gap-2">
                    <Link to={`/contacts/${c.id}`} className="flex-1 font-semibold underline">
                      {nomAffiche(c)}
                    </Link>
                    <button type="button" onClick={() => setContactExistant(c)} className={`${classesBouton('primaire')} h-9 px-3 text-xs`}>
                      Relier
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Adresse */}
      <Card>
        <SectionTitle
          action={
            <button type="button" onClick={localiser} className={`${classesBouton('fantome')} h-9 px-3 text-xs`}>
              <LocateFixed className="size-4" aria-hidden /> Relocaliser
            </button>
          }
        >
          Adresse
        </SectionTitle>
        <p className="-mt-1 mb-3 flex items-center gap-1.5 text-xs font-semibold text-doux">
          <MapPin className="size-3.5" aria-hidden />
          {gps.etat === 'recherche' && 'Recherche de la position…'}
          {gps.etat === 'ok' && `Position trouvée (± ${Math.round(gps.position.precision)} m)`}
          {gps.etat === 'erreur' && gps.message}
          {rechercheAdresse === 'en_cours' && ' · recherche de l’adresse…'}
          {rechercheAdresse === 'plus_tard' && ' · adresse complétée automatiquement au retour du réseau'}
        </p>
        <div className="grid grid-cols-6 gap-2">
          <Saisie
            className="col-span-4"
            placeholder="Rue"
            aria-label="Rue"
            value={adresse.rue}
            onChange={(e) => {
              setAdresseTouchee(true)
              setAdresse({ ...adresse, rue: e.target.value })
            }}
          />
          <Saisie
            className="col-span-2"
            placeholder="N°"
            aria-label="Numéro"
            value={adresse.numero}
            onChange={(e) => {
              setAdresseTouchee(true)
              setAdresse({ ...adresse, numero: e.target.value })
            }}
          />
          <Saisie
            className="col-span-2"
            placeholder="CP"
            inputMode="numeric"
            maxLength={4}
            aria-label="Code postal"
            value={adresse.cp}
            onChange={(e) => {
              setAdresseTouchee(true)
              const cp = e.target.value
              const l = localitesPourCp(cp)
              setAdresse({ ...adresse, cp, ...(l.length === 1 && !adresse.ville ? { ville: l[0] } : {}) })
            }}
          />
          <Saisie
            className="col-span-4"
            placeholder={localites.join(', ') || 'Localité'}
            aria-label="Localité"
            value={adresse.ville}
            onChange={(e) => {
              setAdresseTouchee(true)
              const ville = e.target.value
              const cp = cpPourLocalite(ville)
              setAdresse({ ...adresse, ville, ...(cp && !adresse.cp ? { cp } : {}) })
            }}
          />
        </div>
        {bienDoublons.length > 0 && !bienExistant && (
          <div role="alert" className="mt-3 rounded-2xl bg-suivi-orange/10 p-3 text-sm ring-1 ring-suivi-orange/30">
            <div className="flex items-center gap-2 font-bold text-suivi-orange">
              <AlertTriangle className="size-4" aria-hidden /> Ce bien est peut-être déjà repéré
            </div>
            {bienDoublons.map(({ bien, raison, distance }) => (
              <div key={bien.id} className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <strong>{adresseCourte(bien)}</strong>
                  <span className="text-doux"> · {raison === 'adresse' ? 'même adresse' : `à ${distance} m`}</span>
                </span>
                <button type="button" onClick={() => setBienExistant(bien)} className={`${classesBouton('primaire')} h-9 px-3 text-xs`}>
                  C’est le même
                </button>
              </div>
            ))}
            <p className="mt-2 text-xs text-doux">« C’est le même » ajoute ce repérage au bien existant (photos et historique regroupés).</p>
          </div>
        )}
        {bienExistant && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-suivi-vert/10 p-3 text-sm">
            <Check className="size-5 text-suivi-vert" aria-hidden />
            <span className="flex-1">
              Ajouté au bien existant <strong>{adresseCourte(bienExistant)}</strong>
            </span>
            <button type="button" onClick={() => setBienExistant(null)} className="text-xs font-bold text-doux underline">
              Annuler
            </button>
          </div>
        )}
      </Card>

      {/* Annonce */}
      {categorie === 'annonce' && (
        <Card>
          <SectionTitle>Annonce</SectionTitle>
          <div className="flex flex-col gap-2">
            <Saisie type="text" inputMode="url" autoCapitalize="off" placeholder="Lien de l’annonce (facultatif)" aria-label="Lien de l’annonce" value={lien} onChange={(e) => setLien(e.target.value)} />
            <Saisie inputMode="numeric" placeholder="Prix demandé (€)" aria-label="Prix demandé" value={prix} onChange={(e) => setPrix(e.target.value)} />
            {annonceDoublons.length > 0 && (
              <div role="alert" className="rounded-2xl bg-suivi-orange/10 p-3 text-sm font-semibold text-suivi-orange ring-1 ring-suivi-orange/30">
                Cette annonce est déjà suivie :{' '}
                {annonceDoublons.map((p) => (
                  <Link key={p.id} to={`/pistes/${p.id}`} className="underline">
                    ouvrir la piste
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Indices d'inoccupation */}
      {categorie === 'maison_vide' && (
        <Card>
          <SectionTitle>Indices d’inoccupation</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {INDICES_INOCCUPATION.map((i) => (
              <Puce key={i.code} actif={indices.includes(i.code)} onClick={() => setIndices(indices.includes(i.code) ? indices.filter((x) => x !== i.code) : [...indices, i.code])}>
                {i.libelle}
              </Puce>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <Champ libelle="Note (facultatif)">
          <Zone rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce que vous avez remarqué…" />
        </Champ>
      </Card>

      {erreur && <p className="rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">{erreur}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-fond via-fond/95 to-fond/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <button type="button" disabled={enregistrement || !photosPretes} onClick={enregistrer} className={`${classesBouton('primaire', 'lg')} mx-auto w-full max-w-5xl`}>
          {!photosPretes ? 'Préparation des photos…' : enregistrement ? 'Enregistrement…' : 'Enregistrer le repérage'}
        </button>
      </div>
    </div>
  )
}
