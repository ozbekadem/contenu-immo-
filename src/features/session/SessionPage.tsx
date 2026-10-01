import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, CircleCheck, History, Mail, MessageCircle, Pencil, Phone, SkipForward, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useNomAgence } from '@/app/agence'
import { useAuth } from '@/app/auth'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { argumentaires } from '@/data/repositories/argumentaires'
import { interactions } from '@/data/repositories/interactions'
import { casPour, personnaliserTexte } from '@/domain/argumentaires'
import { priorite as calculerPriorite, type Priorite } from '@/domain/priorite'
import { prixLisible } from '@/domain/prospection'
import { RESULTATS, type CodeResultat } from '@/domain/resultats'
import { formaterTelephone } from '@/domain/telephone'
import { lancerAction, ouvrirMenuContact, surResultatEnregistre } from '@/features/actions/actions'
import { Visuel } from '@/features/aujourdhui/Sections'
import { fileAppels, filtrerCategorie, FILTRES_CATEGORIE, useSuivables, type FiltreCategorie, type Suivable } from '@/features/aujourdhui/useSuivables'

type Etat = CodeResultat | 'passe'

/** Progression gardée le temps de la journée : on peut quitter la session (fiche, argumentaire) et la reprendre. */
interface Sauvegarde {
  jour: string
  filtre: FiltreCategorie
  cles: string[]
  index: number
  etats: Record<string, Etat>
}
const CLE_SESSION = 'linkimmo.session'

function lireSauvegarde(filtre: FiltreCategorie, maintenant: Date): Sauvegarde | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE_SESSION) ?? 'null') as Sauvegarde | null
    return s && s.filtre === filtre && s.jour === maintenant.toDateString() ? s : null
  } catch {
    return null
  }
}

function ecrireSauvegarde(s: Sauvegarde): void {
  try {
    sessionStorage.setItem(CLE_SESSION, JSON.stringify(s))
  } catch {
    /* sans stockage, la session repart du début : sans gravité */
  }
}

const dateCourte = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })

function Historique({ s }: { s: Suivable }) {
  const liste = useLiveQuery(
    () => (s.piste ? interactions.pourPiste(s.piste.id) : s.contact ? interactions.pour(s.contact.id) : Promise.resolve([])),
    [s.piste?.id, s.contact?.id],
  )
  if (!liste?.length) return <p className="text-sm text-doux">Premier contact : aucun échange précédent.</p>
  return (
    <ul className="flex flex-col gap-2">
      {liste.slice(0, 3).map((i) => (
        <li key={i.id} className="text-sm">
          <span className="font-bold">{dateCourte.format(new Date(i.date))}</span> · {RESULTATS[i.resultat]?.libelle ?? i.resultat}
          {i.commentaire && <span className="block text-doux">« {i.commentaire} »</span>}
        </li>
      ))}
    </ul>
  )
}

function CarteArgumentaire({ s, maintenant }: { s: Suivable; maintenant: Date }) {
  const { profil } = useAuth()
  const agence = useNomAgence()
  const noms = { prenom: profil?.nom?.split(' ')[0] ?? null, agence }
  const cas = casPour(
    {
      categorie: s.categorie,
      source: s.piste?.source ?? s.contact?.source ?? null,
      historiquePrix: s.historiquePrix,
      alerte: s.alerte,
      statutsContact: s.contact?.statuts,
    },
    maintenant,
  )
  const a = useLiveQuery(() => argumentaires.pour(cas), [cas])
  if (!a) return null
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-5 text-primaire-texte" aria-hidden />
        <h2 className="flex-1 text-base font-bold">Argumentaire · {a.titre}</h2>
        <Link to={`/argumentaires?cas=${cas}`} className="grid size-9 place-items-center rounded-full bg-surface-2 text-doux" aria-label="Modifier l’argumentaire">
          <Pencil className="size-4" aria-hidden />
        </Link>
      </div>
      {!agence && (
        <Link to="/parametres#agence" className="mb-2 block text-xs font-semibold text-doux underline">
          Renseignez le nom de votre agence dans les Paramètres pour compléter [agence].
        </Link>
      )}
      <p className="rounded-2xl bg-primaire-doux p-3 text-[15px] font-semibold leading-snug text-primaire-texte">{personnaliserTexte(a.accroche, noms)}</p>
      <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        {a.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      {a.objections.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-doux">Objections fréquentes</p>
          {a.objections.map((o) => (
            <details key={o.objection} className="group rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
              <summary className="cursor-pointer list-none font-bold">
                <span className="mr-1 inline-block transition group-open:rotate-90">›</span> « {o.objection} »
              </summary>
              <p className="mt-1.5 leading-snug">{personnaliserTexte(o.reponse, noms)}</p>
            </details>
          ))}
        </div>
      )}
    </Card>
  )
}

function Fiche({ s, priorite, maintenant }: { s: Suivable; priorite: Priorite; maintenant: Date }) {
  const c = s.contact!
  const tel = c._telNorm[0]
  const notes = (s.piste?.notes || c.notes || '').trim()
  return (
    <>
      <Card>
        <Link to={s.lien} className="flex items-center gap-3 active:opacity-70">
          <Visuel s={s} />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold leading-tight">{s.titre}</span>
            <span className="block text-sm font-semibold text-doux">
              {tel ? formaterTelephone(tel) : c.emails[0]}
              {s.piste?.prix ? ` · ${prixLisible(s.piste.prix)}` : ''}
            </span>
          </span>
          <ChevronRight className="size-5 text-doux" aria-hidden />
        </Link>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {priorite.raisons.map((r) => (
            <span key={r} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
              {r}
            </span>
          ))}
        </div>
        {notes && <p className="mt-3 line-clamp-3 text-sm text-doux">{notes}</p>}
        <div className="mt-3 border-t border-bord/60 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-doux">
            <History className="size-3.5" aria-hidden /> Derniers échanges
          </p>
          <Historique s={s} />
        </div>
      </Card>
      <CarteArgumentaire s={s} maintenant={maintenant} />
    </>
  )
}

function Bilan({ file, etats, recommencer }: { file: { suivable: Suivable }[]; etats: Record<string, Etat>; recommencer: () => void }) {
  const notes = Object.values(etats).filter((e) => e !== 'passe') as CodeResultat[]
  const joints = notes.filter((e) => RESULTATS[e]?.joint).length
  const rdv = notes.filter((e) => e === 'rdv' || e === 'visite' || e === 'mandat' || e === 'accord').length
  const passes = Object.values(etats).filter((e) => e === 'passe').length
  return (
    <div className="flex flex-col items-center gap-5 pt-10 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-suivi-vert/12 text-suivi-vert">
        <CircleCheck className="size-10" aria-hidden />
      </span>
      <div>
        <h1 className="text-2xl font-extrabold">Session terminée</h1>
        <p className="mt-1 text-doux">{file.length === 0 ? 'Personne à appeler pour l’instant.' : 'Bravo, votre liste du jour est traitée.'}</p>
      </div>
      {file.length > 0 && (
        <div className="grid w-full grid-cols-3 gap-2">
          {[
            [notes.length, 'appels notés'],
            [joints, 'personnes jointes'],
            [rdv, 'RDV ou plus'],
          ].map(([n, l]) => (
            <Card key={l as string} className="!px-2 text-center">
              <div className="text-3xl font-extrabold">{n}</div>
              <div className="text-xs font-semibold text-doux">{l}</div>
            </Card>
          ))}
        </div>
      )}
      {passes > 0 && <p className="text-sm text-doux">{passes} fiche{passes > 1 ? 's' : ''} passée{passes > 1 ? 's' : ''} : elle{passes > 1 ? 's restent' : ' reste'} dans « Qui appeler en premier ».</p>}
      <Link to="/" className={`${classesBouton('primaire', 'lg')} w-full`}>
        Retour à Aujourd’hui
      </Link>
      {file.length > 0 && (
        <button type="button" onClick={recommencer} className={`${classesBouton('fantome')} w-full`}>
          Nouvelle session avec les appels restants
        </button>
      )}
    </div>
  )
}

/**
 * Session d'appels plein écran : les personnes à appeler aujourd'hui, une par une,
 * avec l'argumentaire adapté. Dès que le résultat est noté, on passe à la suivante.
 */
export default function SessionPage() {
  const [params] = useSearchParams()
  const filtre = (FILTRES_CATEGORIE.find((f) => f.code === params.get('filtre'))?.code ?? 'tout') as FiltreCategorie
  const navigate = useNavigate()
  const { liste, maintenant } = useSuivables()
  // La file est figée au démarrage : une fiche traitée ne disparaît pas sous le doigt.
  const [file, setFile] = useState<{ suivable: Suivable; priorite: Priorite }[] | null>(null)
  const [index, setIndex] = useState(0)
  const [etats, setEtats] = useState<Record<string, Etat>>({})
  const refs = useRef({ file, index, etats })
  refs.current = { file, index, etats }

  useEffect(() => {
    if (!liste || file !== null) return
    const reprise = lireSauvegarde(filtre, maintenant)
    if (reprise) {
      const parCle = new Map(liste.map((s) => [s.cle, s]))
      const restauree = reprise.cles
        .map((cle) => parCle.get(cle))
        .filter((s): s is Suivable => !!s)
        .map((s) => ({ suivable: s, priorite: calculerPriorite(s, maintenant) ?? { score: 0, raisons: [] } }))
      setFile(restauree)
      setEtats(reprise.etats)
      setIndex(Math.min(reprise.index, restauree.length))
      return
    }
    setFile(fileAppels(filtrerCategorie(liste, filtre), maintenant))
  }, [liste, file, filtre, maintenant])

  useEffect(() => {
    if (file) ecrireSauvegarde({ jour: maintenant.toDateString(), filtre, cles: file.map((f) => f.suivable.cle), index, etats })
  }, [file, index, etats, filtre, maintenant])

  const suivant = (depuis: number, nouveauxEtats: Record<string, Etat>) => {
    const f = refs.current.file ?? []
    let i = depuis + 1
    while (i < f.length && nouveauxEtats[f[i]!.suivable.cle]) i++
    setIndex(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(
    () =>
      surResultatEnregistre((r) => {
        const { file: f, index: i, etats: e } = refs.current
        const s = f?.[i]?.suivable
        if (!s) return
        const concerne = s.piste ? r.pisteId === s.piste.id : r.contactId === s.contact?.id && !r.pisteId
        if (!concerne) return
        const nouveaux = { ...e, [s.cle]: r.resultat }
        setEtats(nouveaux)
        setTimeout(() => suivant(i, nouveaux), 400)
      }),
    [],
  )

  // Données toujours à jour pour la fiche affichée (nouveau commentaire, prix…)
  const vivants = useMemo(() => new Map((liste ?? []).map((s) => [s.cle, s])), [liste])

  if (!file) return <p className="pt-10 text-center text-doux">Préparation de la liste…</p>

  const fin = index >= file.length
  const courant = fin ? null : file[index]!
  const s = courant ? (vivants.get(courant.suivable.cle) ?? courant.suivable) : null
  const c = s?.contact
  const tel = c?._telNorm[0]
  const faits = Object.keys(etats).length

  return (
    <div className="flex flex-col gap-4 pb-32">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/')} className="grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Quitter la session">
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold leading-tight">Session d’appels</h1>
          <p className="text-xs font-semibold text-doux">
            {FILTRES_CATEGORIE.find((f) => f.code === filtre)!.libelle} · {faits} / {file.length} traité{faits > 1 ? 's' : ''}
          </p>
        </div>
        {!fin && (
          <div className="flex gap-1">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="grid size-10 place-items-center rounded-full bg-surface-2 disabled:opacity-40" aria-label="Précédent">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" disabled={index >= file.length - 1} onClick={() => setIndex(index + 1)} className="grid size-10 place-items-center rounded-full bg-surface-2 disabled:opacity-40" aria-label="Suivant">
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={file.length} aria-valuenow={faits} aria-label="Avancement">
        <div className="degrade h-full rounded-full transition-all duration-500" style={{ width: `${file.length ? (faits / file.length) * 100 : 100}%` }} />
      </div>

      {fin || !s || !c ? (
        <Bilan
          file={file}
          etats={etats}
          recommencer={() => {
            try {
              sessionStorage.removeItem(CLE_SESSION)
            } catch {
              /* rien à effacer */
            }
            setEtats({})
            setIndex(0)
            setFile(liste ? fileAppels(filtrerCategorie(liste, filtre), maintenant) : null)
          }}
        />
      ) : (
        <>
          <p className="text-center text-sm font-bold text-doux">
            {index + 1}
            <span className="font-semibold"> sur {file.length}</span>
            {etats[s.cle] && <span className="ml-2 rounded-full bg-suivi-vert/12 px-2 py-0.5 text-xs text-suivi-vert">{etats[s.cle] === 'passe' ? 'passé' : RESULTATS[etats[s.cle] as CodeResultat].libelle}</span>}
          </p>
          <Fiche key={s.cle} s={s} priorite={courant!.priorite} maintenant={maintenant} />

          <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-fond via-fond/95 to-fond/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
            <div className="mx-auto flex w-full max-w-5xl gap-2">
              <button
                type="button"
                onClick={() => {
                  const nouveaux = { ...etats, [s.cle]: etats[s.cle] ?? 'passe' }
                  setEtats(nouveaux)
                  suivant(index, nouveaux)
                }}
                className={`${classesBouton('secondaire', 'lg')} w-24 flex-col !gap-0 text-xs`}
              >
                <SkipForward className="size-5" aria-hidden /> Passer
              </button>
              <button
                type="button"
                onClick={() => lancerAction(c, tel ? 'appel' : 'email', null, s.piste?.id ?? null)}
                className={`${classesBouton('primaire', 'lg')} flex-1`}
              >
                {tel ? <Phone className="size-5" aria-hidden /> : <Mail className="size-5" aria-hidden />}
                {tel ? 'Appeler' : 'Écrire'}
              </button>
              <button
                type="button"
                onClick={() => ouvrirMenuContact(c.id, null, s.piste?.id ?? null)}
                className={`${classesBouton('secondaire', 'lg')} w-24 flex-col !gap-0 text-xs`}
              >
                <MessageCircle className="size-5" aria-hidden /> Autre
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
