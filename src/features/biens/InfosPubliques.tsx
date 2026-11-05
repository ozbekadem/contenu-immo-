import { CheckCircle2, ExternalLink, Landmark, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import type { Bien } from '@/data/types'
import { cleRecherche, constats, infosAJour, type InfosPubliques as Infos, type Niveau } from '@/domain/infosPubliques'
import { completerInfosPubliques } from '@/services/infosPubliques'

const APERCU = import.meta.env.MODE === 'apercu'

const POINT: Record<Niveau, string> = {
  ok: 'bg-suivi-vert',
  attention: 'bg-suivi-orange',
  alerte: 'bg-suivi-rouge',
}

const DATE = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
const surface = (m2: number | null) => (m2 == null ? '–' : `${new Intl.NumberFormat('fr-BE').format(m2)}\u00a0m²`)
const minuscule = (t: string) => (t ? t[0]!.toLowerCase() + t.slice(1) : t)

function Ligne({ titre, niveau, children }: { titre: string; niveau?: Niveau; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5 text-sm">
      <dt className="flex items-start gap-2 font-semibold text-doux">
        {niveau && <span className={`mt-1.5 size-2 shrink-0 rounded-full ${POINT[niveau]}`} aria-hidden />}
        <span className={niveau ? '' : 'pl-4'}>{titre}</span>
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Lien({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-primaire-texte">
      {children} <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

function Fiche({ i }: { i: Infos }) {
  const points = constats(i)
  const a = i.adresseOfficielle
  return (
    <>
      <div className="mb-1 flex flex-col gap-1.5">
        {points.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-suivi-vert/10 px-3 py-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 shrink-0 text-suivi-vert" aria-hidden /> Rien à signaler dans les données publiques
          </p>
        ) : (
          points.map((p) => (
            <p key={p.texte} className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${p.niveau === 'alerte' ? 'bg-suivi-rouge/10' : 'bg-suivi-orange/12'}`}>
              <TriangleAlert className={`mt-0.5 size-4 shrink-0 ${p.niveau === 'alerte' ? 'text-suivi-rouge' : 'text-suivi-orange'}`} aria-hidden />
              {p.texte}
            </p>
          ))
        )}
      </div>

      <dl className="divide-y divide-bord/60">
        <Ligne titre="Adresse officielle">
          {a ? `${a.rue} ${a.numero}${a.boite ? ` bte ${a.boite}` : ''}, ${a.cp} ${a.localite}` : <span className="text-doux">Non trouvée au registre : recherche faite au point GPS.</span>}
        </Ligne>
        <Ligne titre="Parcelle">
          {i.parcelle ? (
            <>
              {i.parcelle.division} · section{'\u00a0'}{i.parcelle.section} · n°{'\u00a0'}{i.parcelle.numero}
              <span className="block font-mono text-xs text-doux">{i.parcelle.capakey}</span>
            </>
          ) : (
            <span className="text-doux">Aucune parcelle sous le point : précisez le numéro de l’adresse, ou placez le point sur le bâtiment.</span>
          )}
        </Ligne>
        {(i.parcelle?.surface != null || i.batiment != null) && (
          <Ligne titre="Surfaces">
            <span className="tabular-nums">
              {[i.parcelle?.surface != null && `${surface(i.parcelle.surface)} de terrain`, i.batiment != null && `${surface(i.batiment)} bâtis au sol`].filter(Boolean).join(' · ')}
            </span>
          </Ligne>
        )}
        <Ligne titre="Plan de secteur">
          {i.planSecteur ?? '–'}
          {i.centralite && <span className="block text-xs text-doux">{i.centralite}</span>}
        </Ligne>
        <Ligne titre="Inondation" niveau={i.inondation.auBien ? (/élevé/i.test(i.inondation.auBien) ? 'alerte' : 'attention') : i.inondation.aProximite ? 'attention' : 'ok'}>
          {i.inondation.auBien ?? (i.inondation.aProximite ? `Hors zone, mais ${minuscule(i.inondation.aProximite)} à moins de 50\u00a0m` : 'Hors zone d’aléa')}
          {i.inondation.carte && (
            <span className="block">
              <Lien href={i.inondation.carte}>Carte officielle</Lien>
            </span>
          )}
        </Ligne>
        <Ligne titre="Sous-sol" niveau={i.sousSol.length ? 'attention' : 'ok'}>
          {i.sousSol.length ? i.sousSol.join(' · ') : 'Rien de répertorié'}
          {i.concession && <span className="block text-xs text-doux">Ancienne concession : {i.concession}</span>}
        </Ligne>
        <Ligne titre="Sol (BDES)" niveau={i.sols ? (i.sols.demarches ? 'alerte' : 'attention') : 'ok'}>
          {i.sols ? i.sols.statut : 'Parcelle non reprise à l’inventaire des sols'}
          {i.sols?.lien && (
            <span className="block">
              <Lien href={i.sols.lien}>Fiche de la parcelle</Lien>
            </span>
          )}
        </Ligne>
        <Ligne titre="Patrimoine" niveau={i.patrimoine.length ? 'attention' : 'ok'}>
          {i.patrimoine.length ? (
            <ul className="flex flex-col gap-1">
              {i.patrimoine.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            'Ni classé, ni à l’inventaire'
          )}
        </Ligne>
        {i.quartier && <Ligne titre="Quartier">{i.quartier.nom}</Ligne>}
      </dl>

      {i.manquants.length > 0 && <p className="mt-2 text-xs font-semibold text-suivi-orange">Pas encore disponible : {i.manquants.join(', ')}. Nouvel essai à la prochaine ouverture.</p>}
      <p className="mt-3 text-xs leading-snug text-doux">
        Données publiques du Service public de Wallonie, consultées le {DATE.format(new Date(i.consulteLe))}. Indicatives : elles ne remplacent pas les renseignements urbanistiques demandés par le notaire.
      </p>
    </>
  )
}

/**
 * « Infos publiques » d'un bien : cadastre, plan de secteur, inondation, sous-sol, sols, patrimoine et quartier,
 * cherchés automatiquement dans les services de la Région wallonne et gardés sur la fiche (consultables hors ligne).
 */
export function InfosPubliques({ bien }: { bien: Bien }) {
  const infos = bien.infosPubliques ?? null
  const cle = cleRecherche(bien.adresse, bien.lat, bien.lng)
  const aJour = infosAJour(infos, cle)
  const [recherche, setRecherche] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const chercher = async () => {
    setRecherche(true)
    setErreur(null)
    try {
      await completerInfosPubliques(bien)
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setRecherche(false)
    }
  }

  // Recherche automatique : infos absentes, incomplètes ou faites pour une autre adresse, et réseau disponible.
  useEffect(() => {
    if (!cle || aJour || APERCU || !navigator.onLine) return
    void chercher()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primaire-doux text-primaire-texte">
          <Landmark className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight tracking-tight">Infos publiques</h2>
          <p className="text-xs text-doux">Cadastre, urbanisme et risques · Wallonie</p>
        </div>
        {cle && !APERCU && (
          <button type="button" onClick={() => void chercher()} disabled={recherche} className={`${classesBouton('fantome')} size-10 shrink-0 !p-0`} aria-label="Mettre à jour les infos publiques">
            {recherche ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          </button>
        )}
      </div>

      {!cle ? (
        <p className="text-sm text-doux">Ajoutez l’adresse (rue et numéro) ou placez le bien sur la carte : le cadastre, la zone et les risques s’afficheront ici.</p>
      ) : infos ? (
        <>
          {infos.cle !== cle && <p className="mb-2 rounded-2xl bg-surface-2 px-3 py-2 text-xs font-semibold">L’adresse ou la position a changé depuis cette recherche{recherche ? ' : mise à jour en cours…' : '.'}</p>}
          {erreur && <p className="mb-2 text-xs font-semibold text-suivi-rouge">{erreur}</p>}
          <Fiche i={infos} />
        </>
      ) : recherche ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <p className="flex items-center gap-2 text-sm text-doux">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Consultation du cadastre et des cartes de la Région wallonne…
          </p>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="h-9 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : APERCU ? (
        <p className="text-sm text-doux">Dans cet aperçu en ligne, les services publics wallons ne sont pas joignables. Dans l’application, cette fiche se remplit toute seule : parcelle, surface du terrain, zone du plan de secteur, inondation, puits de mine, sols, patrimoine et quartier.</p>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-doux">{erreur ?? (navigator.onLine ? 'Pas encore cherchées.' : 'Pas de réseau : elles seront cherchées dès que la connexion revient.')}</p>
          {navigator.onLine && (
            <button type="button" onClick={() => void chercher()} className={`${classesBouton('secondaire')} h-10 px-4 text-sm`}>
              <RefreshCw className="size-4" aria-hidden /> {erreur ? 'Réessayer' : 'Chercher maintenant'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
