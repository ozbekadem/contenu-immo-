import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  Check,
  DoorOpen,
  ExternalLink,
  Navigation,
  NotebookPen,
  Phone,
  Signpost,
  TrendingDown,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { DatesCles } from '@/components/DatesCles'
import { PiecesJointes } from '@/components/PiecesJointes'
import { AjoutPhotos, Galerie } from '@/components/Photos'
import { RendezVousFiche } from '@/features/agenda/composants'
import { PrixMarche } from '@/features/marche/PrixMarche'
import { RelanceChoix } from '@/components/RelanceChoix'
import { Avatar } from '@/components/ui/Avatar'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Puce, Saisie } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { Feuille } from '@/components/ui/Feuille'
import { RelancePill } from '@/components/ui/RelancePill'
import { biens } from '@/data/repositories/biens'
import { contacts, contactVide } from '@/data/repositories/contacts'
import { interactions } from '@/data/repositories/interactions'
import { photos as depotPhotos } from '@/data/repositories/photos'
import { pistes } from '@/data/repositories/pistes'
import { SOURCES_CONTACT, type Contact, type Piste } from '@/data/types'
import { ecartJours } from '@/domain/dates'
import { detecterSource } from '@/domain/liens'
import { INDICES_INOCCUPATION, LIBELLE_STATUT, prixLisible, scoreInoccupation, type StatutPiste } from '@/domain/prospection'
import { libelleDernierContact } from '@/domain/relance'
import { RESULTATS } from '@/domain/resultats'
import { formaterTelephone } from '@/domain/telephone'
import { noterEchange, ouvrirMenuContact } from '@/features/actions/actions'
import { initiales, nomAffiche } from '@/features/contacts/affichage'
import { adresseCourte, couleurPiste, liensItineraire } from './affichage'

const ETAPES: StatutPiste[] = ['a_contacter', 'en_cours', 'rdv', 'gagne']

function Entonnoir({ piste }: { piste: Piste }) {
  if (piste.statut === 'perdu') return <p className="rounded-2xl bg-surface-2 p-3 text-center text-sm font-bold text-doux">Piste abandonnée</p>
  const rang = ETAPES.indexOf(piste.statut)
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Étape de la piste">
      {ETAPES.map((s, i) => (
        <li
          key={s}
          aria-current={i === rang ? 'step' : undefined}
          className={`rounded-xl px-1 py-2 text-center text-[11px] font-bold leading-tight ${
            i < rang ? 'bg-primaire-doux text-primaire-texte' : i === rang ? (s === 'gagne' ? 'bg-suivi-vert text-white' : 'degrade text-white') : 'bg-surface-2 text-doux'
          }`}
        >
          {s === 'rdv' ? (piste.categorie === 'maison_vide' ? 'Visite' : 'RDV') : LIBELLE_STATUT[s]}
        </li>
      ))}
    </ol>
  )
}

function Proprietaire({ piste, contact }: { piste: Piste; contact: Contact | null }) {
  const [ajout, setAjout] = useState(false)
  const [tel, setTel] = useState('')
  const [nom, setNom] = useState('')

  const ajouter = async () => {
    const c = await contacts.creer({
      ...contactVide(),
      nom: nom.trim(),
      telephones: tel.trim() ? [{ numero: tel.trim() }] : [],
      statuts: ['prospect_vendeur'],
      source: piste.source,
    })
    await pistes.modifier(piste.id, { contactId: c.id, prochaineRelanceAt: new Date().toISOString() })
    setAjout(false)
  }

  if (contact)
    return (
      <Card>
        <SectionTitle>{piste.categorie === 'maison_vide' ? 'Propriétaire' : 'Vendeur'}</SectionTitle>
        <div className="flex items-center gap-3">
          <Link to={`/contacts/${contact.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar initiales={initiales(contact)} cle={contact.id} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{nomAffiche(contact)}</span>
              <span className="block truncate text-xs text-doux">
                {contact._telNorm[0] ? formaterTelephone(contact._telNorm[0]) : 'pas de téléphone'} · dernier contact{' '}
                {libelleDernierContact(contact.dernierContactAt ? new Date(contact.dernierContactAt) : null)}
              </span>
            </span>
          </Link>
        </div>
      </Card>
    )

  return (
    <Card className="ring-2 ring-maison-vide/25">
      <SectionTitle>Propriétaire inconnu</SectionTitle>
      {!ajout ? (
        <>
          <p className="text-sm text-doux">Voisins, cadastre, commune, notaire… Dès que vous le trouvez, ajoutez-le ici : la piste passe « à appeler ».</p>
          <button type="button" onClick={() => setAjout(true)} className={`${classesBouton('secondaire')} mt-3 h-12 w-full rounded-2xl`}>
            <UserPlus className="size-4" aria-hidden /> Ajouter le propriétaire
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Saisie type="tel" inputMode="tel" placeholder="Téléphone" aria-label="Téléphone du propriétaire" value={tel} onChange={(e) => setTel(e.target.value)} />
          <Saisie placeholder="Nom" aria-label="Nom du propriétaire" value={nom} onChange={(e) => setNom(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAjout(false)} className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl`}>
              Annuler
            </button>
            <button type="button" disabled={!tel.trim() && !nom.trim()} onClick={ajouter} className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

function Annonce({ piste, maintenant }: { piste: Piste; maintenant: Date }) {
  const [nouveauPrix, setNouveauPrix] = useState('')
  const [saisiePrix, setSaisiePrix] = useState(false)
  const depuis = piste.enVenteDepuis ? ecartJours(new Date(piste.enVenteDepuis), maintenant) : null
  const source = piste.sourceUrl ? detecterSource(piste.sourceUrl).libelle : SOURCES_CONTACT.find((s) => s.code === piste.source)?.libelle
  const aVerifier = piste.veilleProchaine && new Date(piste.veilleProchaine) <= maintenant
  const estAffiche = !piste.sourceUrl

  const enregistrerPrix = async () => {
    const p = Number(nouveauPrix.replace(/[^\d]/g, ''))
    if (!p) return
    await pistes.veillePrix(piste, p)
    setSaisiePrix(false)
    setNouveauPrix('')
  }

  return (
    <Card>
      <SectionTitle>Annonce</SectionTitle>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="text-xs font-semibold text-doux">Prix demandé</div>
          <div className="font-extrabold">{piste.prix ? prixLisible(piste.prix) : '—'}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="text-xs font-semibold text-doux">En vente depuis</div>
          <div className="font-extrabold">{depuis !== null ? `${depuis} jour${depuis > 1 ? 's' : ''}` : '—'}</div>
        </div>
      </div>
      {piste.historiquePrix.length > 1 && (
        <ol className="mt-3 flex flex-col gap-1 text-sm">
          {piste.historiquePrix.map((h, i) => {
            const precedent = piste.historiquePrix[i - 1]
            const baisse = precedent && h.prix < precedent.prix
            return (
              <li key={h.date} className="flex items-center justify-between">
                <span className="text-doux">{new Date(h.date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className={`flex items-center gap-1 font-bold ${baisse ? 'text-suivi-vert' : ''}`}>
                  {baisse && <TrendingDown className="size-4" aria-hidden />}
                  {prixLisible(h.prix)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {piste.sourceUrl && (
        <a href={piste.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${classesBouton('secondaire')} mt-3 h-11 w-full rounded-2xl`}>
          <ExternalLink className="size-4" aria-hidden /> Ouvrir l’annonce {source}
        </a>
      )}

      {/* Veille */}
      <div className={`mt-3 rounded-2xl p-3 ${aVerifier ? 'bg-suivi-orange/10 ring-1 ring-suivi-orange/30' : 'bg-surface-2'}`}>
        <div className="text-sm font-bold">{estAffiche ? 'L’affiche est-elle toujours là ?' : 'L’annonce est-elle toujours en ligne ?'}</div>
        <div className="text-xs text-doux">
          {piste.veilleEtat !== 'actif'
            ? { retiree: 'Annonce retirée', disparue: 'Affiche disparue', agence: 'Panneau d’agence apparu', actif: '' }[piste.veilleEtat]
            : piste.veilleProchaine
              ? aVerifier
                ? 'À revérifier aujourd’hui'
                : `Prochaine vérification le ${new Date(piste.veilleProchaine).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}`
              : 'Pas de vérification programmée'}
        </div>
        {piste.veilleEtat === 'actif' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => pistes.veilleToujoursLa(piste)} className="presse h-9 rounded-full bg-surface px-3 text-xs font-bold">
              <Check className="mr-1 inline size-3.5" aria-hidden />
              {estAffiche ? 'Toujours là' : 'Toujours en ligne'}
            </button>
            {!estAffiche && (
              <button type="button" onClick={() => setSaisiePrix(true)} className="presse h-9 rounded-full bg-surface px-3 text-xs font-bold">
                Prix changé
              </button>
            )}
            <button type="button" onClick={() => pistes.veilleChangement(piste, estAffiche ? 'disparue' : 'retiree')} className="presse h-9 rounded-full bg-suivi-rouge/10 px-3 text-xs font-bold text-suivi-rouge">
              {estAffiche ? 'Affiche disparue' : 'Annonce retirée'}
            </button>
            {estAffiche && (
              <button type="button" onClick={() => pistes.veilleChangement(piste, 'agence')} className="presse h-9 rounded-full bg-suivi-rouge/10 px-3 text-xs font-bold text-suivi-rouge">
                Panneau d’agence
              </button>
            )}
          </div>
        )}
        {saisiePrix && (
          <div className="mt-2 flex gap-2">
            <Saisie inputMode="numeric" autoFocus placeholder="Nouveau prix (€)" aria-label="Nouveau prix" value={nouveauPrix} onChange={(e) => setNouveauPrix(e.target.value)} className="flex-1" />
            <button type="button" onClick={enregistrerPrix} className={`${classesBouton('primaire')} h-12 rounded-2xl`}>
              OK
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

function Indices({ piste }: { piste: Piste }) {
  const score = scoreInoccupation(piste.indices)
  const basculer = (code: string) =>
    pistes.modifier(piste.id, { indices: piste.indices.includes(code) ? piste.indices.filter((x) => x !== code) : [...piste.indices, code] })
  return (
    <Card>
      <SectionTitle action={<span className="rounded-full bg-maison-vide/15 px-2.5 py-1 text-xs font-bold text-maison-vide">Vide probable : {score} %</span>}>
        Indices d’inoccupation
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {INDICES_INOCCUPATION.map((i) => (
          <Puce key={i.code} actif={piste.indices.includes(i.code)} onClick={() => basculer(i.code)}>
            {i.libelle}
          </Puce>
        ))}
      </div>
    </Card>
  )
}

function HistoriquePiste({ piste }: { piste: Piste }) {
  const liste = useLiveQuery(() => interactions.pourPiste(piste.id), [piste.id])
  if (!liste) return null
  return (
    <Card>
      <SectionTitle>Historique</SectionTitle>
      {liste.length === 0 ? (
        <p className="text-sm text-doux">
          Repéré le {new Date(piste.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}. Aucun échange pour l’instant.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {liste.map((i) => (
            <li key={i.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold">{RESULTATS[i.resultat].libelle}</span>
                <span className="text-xs text-doux">
                  {new Date(i.date).toLocaleString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {i.commentaire && <p className="mt-1 whitespace-pre-wrap">{i.commentaire}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export default function PistePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation() as { state: { nouveau?: boolean } | null }
  const piste = useLiveQuery(() => pistes.get(id), [id], null)
  const bien = useLiveQuery(async () => (piste ? ((await biens.get(piste.bienId)) ?? null) : null), [piste?.bienId])
  const contact = useLiveQuery(async () => (piste?.contactId ? ((await contacts.get(piste.contactId)) ?? null) : null), [piste?.contactId])
  const listePhotos = useLiveQuery(() => (piste ? depotPhotos.duBien(piste.bienId) : Promise.resolve([])), [piste?.bienId]) ?? []
  const [planifier, setPlanifier] = useState(false)

  if (piste === null || bien === undefined || contact === undefined) return null
  if (!piste || !bien)
    return (
      <div className="py-16 text-center">
        <p className="text-doux">Cette piste n’existe pas (ou plus sur cet appareil).</p>
        <Link to="/prospection" className="mt-4 inline-block font-semibold text-primaire-texte underline">
          Retour à la prospection
        </Link>
      </div>
    )

  const maintenant = new Date()
  const couleur = couleurPiste(piste, maintenant)
  const itineraire = liensItineraire(bien)
  const joignable = contact && !contact.nePasContacter && (contact._telNorm.length > 0 || contact.emails.length > 0)

  const basculerArchive = async () => {
    if (piste.archivedAt) return pistes.restaurer(piste.id)
    const ok = await confirmer({ titre: 'Archiver cette piste ?', message: 'Elle disparaît des listes mais n’est jamais effacée.', confirmer: 'Archiver' })
    if (ok) await pistes.archiver(piste.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="presse grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <AjoutPhotos bienId={bien.id} pisteId={piste.id} demo={!!piste._demo} />
      </div>

      {state?.nouveau && (
        <p className="flex items-center gap-2 rounded-2xl bg-suivi-vert/12 p-3 text-sm font-bold text-suivi-vert">
          <Check className="size-5" aria-hidden /> Repérage enregistré{navigator.onLine ? '' : ' sur l’appareil — envoi au retour du réseau'}.
        </p>
      )}

      <Galerie liste={listePhotos} />

      <Card className="!p-5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white ${piste.categorie === 'annonce' ? 'bg-annonce' : 'bg-maison-vide'}`}>
            {piste.categorie === 'annonce' ? <Signpost className="size-3.5" /> : <DoorOpen className="size-3.5" />}
            {piste.categorie === 'annonce' ? 'Annonce de particulier' : 'Maison vide'}
          </span>
          {piste._demo && <span className="degrade rounded-full px-2.5 py-1 text-xs font-bold text-white">Démo</span>}
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">{adresseCourte(bien)}</h1>
        {bien.adresse?.cp && <p className="text-sm font-medium text-doux">{bien.adresse.cp}</p>}
        <Link to={`/biens/${bien.id}`} className="mt-1 inline-block text-xs font-bold text-primaire-texte">
          Fiche du bien (position, caractéristiques, autres pistes) →
        </Link>
        {piste.alerte && (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-bold text-suivi-rouge">
            <AlertTriangle className="size-4" aria-hidden /> {piste.alerte} — à appeler aujourd’hui
          </p>
        )}
        <div className="mt-4">
          <Entonnoir piste={piste} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!joignable}
            onClick={() => contact && ouvrirMenuContact(contact.id, null, piste.id)}
            className={`${classesBouton('primaire')} h-14 flex-col gap-0.5 rounded-2xl text-xs`}
          >
            <Phone className="size-5" aria-hidden /> Contacter
          </button>
          <button type="button" onClick={() => noterEchange(contact?.id ?? null, piste.id)} className={`${classesBouton('fantome')} h-14 flex-col gap-0.5 rounded-2xl text-xs`}>
            <NotebookPen className="size-5" aria-hidden /> Noter
          </button>
          {itineraire ? (
            <a href={itineraire.google} target="_blank" rel="noopener noreferrer" className={`${classesBouton('fantome')} h-14 flex-col gap-0.5 rounded-2xl text-xs`}>
              <Navigation className="size-5" aria-hidden /> Itinéraire
            </a>
          ) : (
            <span />
          )}
        </div>
        {itineraire && (
          <a href={itineraire.waze} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-bold text-primaire-texte">
            Ouvrir dans Waze
          </a>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="text-xs font-semibold text-doux">Dernier contact</div>
            <div className="mt-0.5 font-bold">{libelleDernierContact(piste.dernierContactAt ? new Date(piste.dernierContactAt) : null, maintenant)}</div>
            {piste.tentatives > 0 && <div className="text-xs text-doux">{piste.tentatives} appel(s) sans réponse</div>}
          </div>
          <button type="button" onClick={() => setPlanifier(true)} className="presse flex flex-col items-start rounded-2xl bg-surface-2 p-3 text-left">
            <span className="text-xs font-semibold text-doux">Prochaine relance</span>
            <span className="mt-1">
              <RelancePill couleur={couleur} relance={piste.prochaineRelanceAt ? new Date(piste.prochaineRelanceAt) : null} maintenant={maintenant} />
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs font-bold text-primaire-texte">
              <CalendarClock className="size-3.5" aria-hidden /> Planifier
            </span>
          </button>
        </div>
      </Card>

      <Proprietaire piste={piste} contact={contact} />
      {piste.categorie === 'annonce' && <Annonce piste={piste} maintenant={maintenant} />}
      <PrixMarche bien={bien} prix={piste.categorie === 'annonce' ? piste.prix : null} />
      {piste.categorie === 'maison_vide' && <Indices piste={piste} />}
      <DatesCles dates={piste.datesCles} prochaineRelanceAt={piste.prochaineRelanceAt} enregistrer={(datesCles, prochaineRelanceAt) => pistes.modifier(piste.id, { datesCles, prochaineRelanceAt })} />
      {piste.notes && (
        <Card>
          <SectionTitle>Notes du repérage</SectionTitle>
          <p className="whitespace-pre-wrap text-sm">{piste.notes}</p>
        </Card>
      )}
      <RendezVousFiche pre={{ contactId: piste.contactId, pisteId: piste.id, bienId: piste.bienId, type: piste.categorie === 'maison_vide' ? 'visite' : 'rdv' }} />
      <HistoriquePiste piste={piste} />
      <PiecesJointes entite="pistes" entiteId={piste.id} />

      <button type="button" onClick={basculerArchive} className={`${classesBouton('fantome')} mt-2 w-full text-doux`}>
        {piste.archivedAt ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {piste.archivedAt ? 'Restaurer la piste' : 'Archiver la piste'}
      </button>

      <Feuille titre="Planifier une relance" ouverte={planifier} fermer={() => setPlanifier(false)}>
        <RelanceChoix
          valeur={piste.prochaineRelanceAt}
          onChange={async (iso) => {
            await pistes.modifier(piste.id, { prochaineRelanceAt: iso })
            setPlanifier(false)
          }}
        />
      </Feuille>
    </div>
  )
}
