import { ArrowDownRight, ArrowUpRight, Info, Minus, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Liste, Puce } from '@/components/ui/Champ'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  annuels,
  arrondissement,
  BELGIQUE,
  corrigerInflation,
  dernierAnnuel,
  evolution,
  nomLisible,
  serie,
  trimestres,
  TYPES_MARCHE,
  WALLONIE,
  type DonneesMarche,
  type TypeMarche,
} from '@/domain/marche'
import { euros, kEuros, useMarche } from './donnees'
import { GraphiquePrix, type PointGraphique } from './GraphiquePrix'

const CLE_COMMUNE = 'linkimmo.marche.commune'
const CHARLEROI = '52011'
const nf = new Intl.NumberFormat('fr-BE')

function lireCommune(): string {
  try {
    return localStorage.getItem(CLE_COMMUNE) ?? CHARLEROI
  } catch {
    return CHARLEROI
  }
}

function Evolution({ valeur, duree }: { valeur: number | null; duree: string }) {
  const Icone = valeur === null ? Minus : valeur > 0.5 ? ArrowUpRight : valeur < -0.5 ? ArrowDownRight : Minus
  return (
    <>
      <p className="text-xs font-semibold text-doux">Sur {duree}</p>
      <p className="mt-0.5 flex items-center gap-1 whitespace-nowrap font-bold tabular-nums">
        <Icone className="size-4 shrink-0" aria-hidden />
        {valeur === null ? 'non disponible' : `${valeur > 0 ? '+' : ''}${nf.format(valeur)} %`}
      </p>
    </>
  )
}

/** Communes de l'arrondissement, de la plus chère à la moins chère (dernière année complète). */
function Classement({ d, commune, type, annee }: { d: DonneesMarche; commune: string; type: TypeMarche; annee: number }) {
  const lignes = Object.entries(d.zones)
    .filter(([code, z]) => z.niveau === 5 && code.slice(0, 2) === commune.slice(0, 2))
    .map(([code, z]) => ({ code, nom: nomLisible(z.nom), p: annuels(serie(d, code, type)).find((x) => x.annee === annee) ?? null }))
    .sort((a, b) => (b.p?.mediane ?? -1) - (a.p?.mediane ?? -1))
  const max = Math.max(...lignes.map((l) => l.p?.mediane ?? 0))
  return (
    <ul className="flex flex-col gap-2">
      {lignes.map((l) => (
        <li key={l.code} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 text-sm">
          <span className={`truncate ${l.code === commune ? 'font-extrabold' : 'font-semibold'}`}>{l.nom}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            {l.p?.mediane && <span className="block h-full rounded-full bg-[var(--viz-1)]" style={{ width: `${(l.p.mediane / max) * 100}%`, opacity: l.code === commune ? 1 : 0.55 }} />}
          </span>
          <span className="w-24 text-right text-xs tabular-nums">
            {l.p?.mediane ? <strong>{kEuros(l.p.mediane)}</strong> : <span className="text-doux">non publié</span>}
            {l.p?.ventes != null && <span className="block text-[11px] text-doux">{nf.format(l.p.ventes)} ventes</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Marché local : prix de vente réels (Statbel) par commune, évolution, comparaison et classement. */
export default function MarchePage() {
  const d = useMarche()
  const [params, setParams] = useSearchParams()
  const commune = params.get('commune') ?? lireCommune()
  const type = (TYPES_MARCHE.find((t) => t.code === params.get('type'))?.code ?? 'm23') as TypeMarche
  const [reference, setReference] = useState<'arrondissement' | 'wallonie' | 'belgique' | 'aucune'>('arrondissement')
  const [inflation, setInflation] = useState(false)
  const [tableau, setTableau] = useState(false)

  const changer = (patch: { commune?: string; type?: TypeMarche }) => {
    const suivant = { commune, type, ...patch }
    if (patch.commune) {
      try {
        localStorage.setItem(CLE_COMMUNE, patch.commune)
      } catch {
        /* préférence non mémorisée */
      }
    }
    setParams(suivant, { replace: true })
  }

  const vue = useMemo(() => {
    if (!d || !d.zones[commune]) return null
    const s = serie(d, commune, type)
    const codeRef = reference === 'arrondissement' ? arrondissement(commune) : reference === 'wallonie' ? WALLONIE : reference === 'belgique' ? BELGIQUE : null
    const ref = codeRef ? annuels(serie(d, codeRef, type)) : []
    // Euros de la dernière année complète : son chiffre reste inchangé, les années passées sont réévaluées.
    const derniereAnnee = dernierAnnuel(s)?.annee ?? Math.max(...Object.keys(d.indice).map(Number))
    const corriger = (v: number | null, annee: number) => {
      if (v == null || !inflation) return v
      const c = corrigerInflation(v, annee, derniereAnnee, d.indice)
      return c == null ? null : Math.round(c / 100) * 100
    }
    const points: PointGraphique[] = annuels(s).map((p) => ({
      annee: p.annee,
      mediane: corriger(p.mediane, p.annee)!,
      p25: corriger(p.p25, p.annee),
      p75: corriger(p.p75, p.annee),
      ventes: p.ventes,
      comparaison: corriger(ref.find((r) => r.annee === p.annee)?.mediane ?? null, p.annee),
    }))
    return {
      s,
      points,
      dernier: dernierAnnuel(s),
      trimestre: trimestres(s).at(-1) ?? null,
      libelleRef: codeRef ? nomLisible(d.zones[codeRef]?.nom ?? '') : null,
      derniereAnnee,
    }
  }, [d, commune, type, reference, inflation])

  const arrondissements = useMemo(() => {
    if (!d) return []
    return Object.entries(d.zones)
      .filter(([, z]) => z.niveau === 4)
      .map(([code, z]) => ({
        nom: nomLisible(z.nom),
        communes: Object.entries(d.zones)
          .filter(([c, x]) => x.niveau === 5 && c.slice(0, 2) === code.slice(0, 2))
          .map(([c, x]) => ({ code: c, nom: nomLisible(x.nom) }))
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      }))
      .sort((a, b) => (a.nom.includes('Charleroi') ? -1 : b.nom.includes('Charleroi') ? 1 : a.nom.localeCompare(b.nom, 'fr')))
  }, [d])

  if (!d) return <PageHeader titre="Marché local" sousTitre="Chargement des prix…" />
  const nomCommune = nomLisible(d.zones[commune]?.nom ?? '')
  const libelleType = TYPES_MARCHE.find((t) => t.code === type)!.libelle
  const [anneeT, numT] = d.derniere.split(' T')

  return (
    <>
      <PageHeader titre="Marché local" sousTitre={`Prix de vente réels (actes signés) · Statbel, jusqu’au ${numT}${numT === '1' ? 'er' : 'e'} trimestre ${anneeT}`} />
      <div className="flex flex-col gap-4">
        <Liste aria-label="Commune" value={commune} onChange={(e) => changer({ commune: e.target.value })}>
          {arrondissements.map((a) => (
            <optgroup key={a.nom} label={a.nom}>
              {a.communes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nom}
                </option>
              ))}
            </optgroup>
          ))}
        </Liste>
        <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="group" aria-label="Type de bien">
          {TYPES_MARCHE.map((t) => (
            <Puce key={t.code} actif={type === t.code} onClick={() => changer({ type: t.code })}>
              {t.libelle}
            </Puce>
          ))}
        </div>

        {!vue?.dernier ? (
          <Card className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-doux" aria-hidden />
            <p className="text-sm text-doux">
              Pas assez de ventes à {nomCommune} pour publier un prix ({libelleType.toLowerCase()}) : Statbel ne donne un prix qu’à partir de 16 ventes. Essayez « Toutes les maisons ».
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <p className="text-sm font-semibold text-doux">
                {nomCommune} · {libelleType} · {vue.dernier.annee}
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">{euros(vue.dernier.mediane)}</p>
              <p className="text-sm text-doux">prix médian : la moitié des biens s’est vendue moins cher, l’autre moitié plus cher</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-doux">La moitié des ventes entre</p>
                  <p className="mt-0.5 font-bold tabular-nums">
                    {kEuros(vue.dernier.p25!)} et {kEuros(vue.dernier.p75!)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-doux">Ventes en {vue.dernier.annee}</p>
                  <p className="mt-0.5 font-bold tabular-nums">{vue.dernier.ventes != null ? nf.format(vue.dernier.ventes) : 'non communiqué'}</p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <Evolution valeur={evolution(vue.s, 1)} duree="1 an" />
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <Evolution valeur={evolution(vue.s, 5)} duree="5 ans" />
                </div>
              </div>
              {vue.trimestre && (
                <p className="mt-3 rounded-2xl bg-primaire-doux p-3 text-sm text-primaire-texte">
                  <strong>
                    Dernier trimestre ({vue.trimestre.periode.replace('Q', 'T')} {vue.trimestre.annee}) :
                  </strong>{' '}
                  {vue.trimestre.mediane ? `médiane ${euros(vue.trimestre.mediane)}` : 'prix non publié (trop peu de ventes)'}
                  {vue.trimestre.ventes != null && `, ${nf.format(vue.trimestre.ventes)} ventes`}
                </p>
              )}
            </Card>

            <Card>
              <SectionTitle
                action={
                  <button type="button" onClick={() => setTableau(!tableau)} className="flex items-center gap-1 text-xs font-bold text-primaire-texte" aria-pressed={tableau}>
                    <Table2 className="size-4" aria-hidden /> {tableau ? 'Graphique' : 'Tableau'}
                  </button>
                }
              >
                Évolution depuis {vue.points[0]?.annee}
              </SectionTitle>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Liste aria-label="Comparer avec" value={reference} onChange={(e) => setReference(e.target.value as typeof reference)} className="h-10 w-auto flex-1 text-sm">
                  <option value="arrondissement">Comparer : {nomLisible(d.zones[arrondissement(commune)]?.nom ?? 'arrondissement')}</option>
                  <option value="wallonie">Comparer : Wallonie</option>
                  <option value="belgique">Comparer : Belgique</option>
                  <option value="aucune">Sans comparaison</option>
                </Liste>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={inflation} onChange={(e) => setInflation(e.target.checked)} className="size-5 accent-[var(--color-primaire)]" />
                  En euros de {vue.derniereAnnee}
                </label>
              </div>
              {tableau ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="text-left text-xs text-doux">
                        <th className="py-1 font-semibold">Année</th>
                        <th className="py-1 text-right font-semibold">Médiane</th>
                        <th className="py-1 text-right font-semibold">50 % entre</th>
                        <th className="py-1 text-right font-semibold">Ventes</th>
                        {vue.libelleRef && <th className="py-1 text-right font-semibold">{vue.libelleRef}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...vue.points].reverse().map((p) => (
                        <tr key={p.annee} className="border-t border-bord/60">
                          <td className="py-1.5 font-semibold">{p.annee}</td>
                          <td className="py-1.5 text-right font-bold">{euros(p.mediane)}</td>
                          <td className="py-1.5 text-right text-doux">{p.p25 != null && p.p75 != null ? `${kEuros(p.p25)} – ${kEuros(p.p75)}` : '–'}</td>
                          <td className="py-1.5 text-right">{p.ventes != null ? nf.format(p.ventes) : '–'}</td>
                          {vue.libelleRef && <td className="py-1.5 text-right">{p.comparaison != null ? kEuros(p.comparaison) : '–'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <GraphiquePrix points={vue.points} libelle={nomCommune} libelleComparaison={vue.libelleRef} />
              )}
              {inflation && <p className="mt-2 text-xs text-doux">Prix corrigés de l’inflation (indice des prix à la consommation, Statbel) : on compare à pouvoir d’achat égal.</p>}
            </Card>
          </>
        )}

        <Card>
          <SectionTitle>
            Communes de l’{nomLisible(d.zones[arrondissement(commune)]?.nom ?? '').replace(/^Arrondissement de /, 'arrondissement de ')} · {vue?.dernier?.annee ?? vue?.derniereAnnee}
          </SectionTitle>
          <Classement d={d} commune={commune} type={type} annee={vue?.dernier?.annee ?? Number(anneeT) - 1} />
        </Card>

        <Card className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-doux" aria-hidden />
          <div className="text-xs leading-relaxed text-doux">
            <p className="font-bold text-texte">À savoir</p>
            <p>Prix des ventes réellement signées chez le notaire (pas des annonces), quelques mois après la vente.</p>
            <p>Un prix n’est publié qu’à partir de 16 ventes : les petites communes ont parfois des trous.</p>
            <p>Chiffre pour toute la commune : à Charleroi, Marcinelle et Gosselies sont confondus. Pas de prix au m² (surface non publiée).</p>
          </div>
        </Card>
      </div>
    </>
  )
}
