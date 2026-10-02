import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Card } from '@/components/ui/Card'
import { db } from '@/data/db'
import { ajouterJours, debutJour } from '@/domain/dates'
import { aMaturite } from '@/domain/quotidien'
import { chiffres, periode } from '@/domain/statistiques'
import { useSuivables } from '@/features/aujourdhui/useSuivables'

const CLE = 'linkimmo.revue'

function lireFaits(semaine: string): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(CLE) ?? 'null') as { semaine: string; faits: string[] } | null
    return r?.semaine === semaine ? r.faits : []
  } catch {
    return []
  }
}

interface Point {
  cle: string
  titre: string
  detail: string
  nombre: number
  lien: string
  action: string
}

/**
 * Revue du vendredi (5 minutes) : le bilan de la semaine et tout ce qui risque d'être oublié,
 * point par point, avec un lien direct pour traiter. On coche au fur et à mesure.
 */
export default function RevuePage() {
  const navigate = useNavigate()
  const { liste, maintenant } = useSuivables()
  const autres = useLiveQuery(async () => {
    const [interactions, pistes, evenements] = await Promise.all([db.interactions.toArray(), db.pistes.toArray(), db.evenements.toArray()])
    return { interactions, pistes, evenements }
  }, [])
  const semaine = periode('semaine', maintenant).du.toISOString().slice(0, 10)
  const [faits, setFaits] = useState<string[]>(() => lireFaits(semaine))
  const basculer = (cle: string) => {
    const suivants = faits.includes(cle) ? faits.filter((x) => x !== cle) : [...faits, cle]
    setFaits(suivants)
    try {
      localStorage.setItem(CLE, JSON.stringify({ semaine, faits: suivants }))
    } catch {
      /* non mémorisé */
    }
  }

  const vue = useMemo(() => {
    if (!liste || !autres) return null
    const bilan = chiffres(autres.interactions, autres.pistes, periode('semaine', maintenant))
    const lundiProchain = ajouterJours(periode('semaine', maintenant).du, 7)
    const finProchaine = ajouterJours(lundiProchain, 7)
    const entre = (iso: string | null, du: Date, au: Date) => !!iso && new Date(iso) >= du && new Date(iso) < au
    const joignables = liste.filter((s) => !s.contact?.nePasContacter)
    const points: Point[] = [
      {
        cle: 'sans-action',
        titre: 'Fiches sans prochaine action',
        detail: 'Donnez une date de relance à chacune (ou archivez).',
        nombre: joignables.filter((s) => !s.prochaineRelanceAt).length,
        lien: '/',
        action: 'Traiter',
      },
      {
        cle: 'retard',
        titre: 'Relances en retard de plus de 7 jours',
        detail: 'Appelez-les en session, ou replanifiez si ce n’est plus le moment.',
        nombre: joignables.filter((s) => s.prochaineRelanceAt && new Date(s.prochaineRelanceAt) < ajouterJours(debutJour(maintenant), -7)).length,
        lien: '/session',
        action: 'Session d’appels',
      },
      {
        cle: 'veille',
        titre: 'Annonces et affiches à revérifier',
        detail: 'Toujours en ligne ? Prix changé ? Panneau d’agence ?',
        nombre: autres.pistes.filter((p) => !p.archivedAt && p.veilleEtat === 'actif' && p.statut !== 'gagne' && p.statut !== 'perdu' && p.veilleProchaine && new Date(p.veilleProchaine) <= maintenant).length,
        lien: '/',
        action: 'Vérifier',
      },
      {
        cle: 'encoder',
        titre: 'Estimations à encoder',
        detail: 'Reçues par Google Agenda : créez ou reliez la fiche.',
        nombre: autres.evenements.filter((e) => e.aEncoder && !e.archivedAt).length,
        lien: '/',
        action: 'Encoder',
      },
      {
        cle: 'maturite',
        titre: 'Dates clés qui approchent',
        detail: 'Fin de bail, projet de vente, pension… c’est le moment d’appeler.',
        nombre: aMaturite(
          joignables.map((s) => ({ quoi: s, datesCles: s.datesCles })),
          maintenant,
        ).length,
        lien: '/',
        action: 'Voir',
      },
    ]
    return {
      bilan,
      points,
      prochaine: {
        relances: joignables.filter((s) => entre(s.prochaineRelanceAt, lundiProchain, finProchaine)).length,
        rdv: autres.evenements.filter((e) => !e.archivedAt && entre(e.debut, lundiProchain, finProchaine)).length,
      },
    }
  }, [liste, autres, maintenant])

  if (!vue) return null
  const restants = vue.points.filter((p) => p.nombre > 0 && !faits.includes(p.cle)).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Revue du vendredi</h1>
          <p className="text-xs font-semibold text-doux">{restants === 0 ? 'Tout est en ordre. Bon week-end !' : `${restants} point${restants > 1 ? 's' : ''} à regarder`}</p>
        </div>
      </div>

      <Card>
        <p className="text-sm font-bold">Votre semaine</p>
        <p className="mt-1 text-sm text-doux">
          <strong className="text-texte">{vue.bilan.appels}</strong> appels, <strong className="text-texte">{vue.bilan.joints}</strong> personnes jointes,{' '}
          <strong className="text-texte">{vue.bilan.rdv}</strong> RDV, <strong className="text-texte">{vue.bilan.signatures}</strong> mandat{vue.bilan.signatures > 1 ? 's' : ''},{' '}
          <strong className="text-texte">{vue.bilan.reperages}</strong> repérage{vue.bilan.reperages > 1 ? 's' : ''}.
        </p>
      </Card>

      <ul className="flex flex-col gap-2">
        {vue.points.map((p) => {
          const fait = faits.includes(p.cle) || p.nombre === 0
          return (
            <li key={p.cle}>
              <Card className={`flex items-center gap-3 !p-3 ${fait ? 'opacity-60' : ''}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={fait}
                  aria-label={`${p.titre} : fait`}
                  disabled={p.nombre === 0}
                  onClick={() => basculer(p.cle)}
                  className={`grid size-8 shrink-0 place-items-center rounded-full ring-2 ${fait ? 'bg-suivi-vert text-white ring-suivi-vert' : 'ring-bord'}`}
                >
                  {fait && <Check className="size-4" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">
                    {p.titre} <span className="tabular-nums text-primaire-texte">{p.nombre}</span>
                  </p>
                  <p className="text-xs text-doux">{p.nombre === 0 ? 'Rien à faire.' : p.detail}</p>
                </div>
                {p.nombre > 0 && (
                  <Link to={p.lien} className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-primaire-texte">
                    {p.action}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <Card>
        <p className="text-sm font-bold">La semaine prochaine</p>
        <p className="mt-1 text-sm text-doux">
          {vue.prochaine.relances} relance{vue.prochaine.relances > 1 ? 's' : ''} et {vue.prochaine.rdv} rendez-vous prévus.{' '}
          <Link to="/agenda" className="font-bold text-primaire-texte">
            Voir l’agenda
          </Link>
        </p>
      </Card>
    </div>
  )
}
