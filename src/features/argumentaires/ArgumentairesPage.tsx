import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { Champ, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { PageHeader } from '@/components/ui/PageHeader'
import { argumentaires } from '@/data/repositories/argumentaires'
import { ARGUMENTAIRES_DEFAUT, ORDRE_CAS, type CasArgumentaire, type Objection } from '@/domain/argumentaires'

function Editeur({ cas }: { cas: CasArgumentaire }) {
  const a = useLiveQuery(() => argumentaires.pour(cas), [cas])
  const [accroche, setAccroche] = useState('')
  const [points, setPoints] = useState('')
  const [objections, setObjections] = useState<Objection[]>([])
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    if (!a) return
    setAccroche(a.accroche)
    setPoints(a.points.join('\n'))
    setObjections(a.objections)
    // Recharger uniquement quand on change de situation ou après « Rétablir ».
  }, [a?.cas, a?.modifie]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return null

  const enregistrer = async () => {
    await argumentaires.enregistrer(cas, { accroche, points: points.split('\n'), objections })
    setEnregistre(true)
    setTimeout(() => setEnregistre(false), 2000)
  }
  const retablir = async () => {
    const ok = await confirmer({
      titre: 'Revenir au texte d’origine ?',
      message: 'Votre version est gardée dans l’historique, mais ne sera plus utilisée pendant les appels.',
      confirmer: 'Rétablir',
    })
    if (ok) await argumentaires.retablir(cas)
  }
  const changerObjection = (i: number, champ: keyof Objection, valeur: string) => setObjections(objections.map((o, j) => (j === i ? { ...o, [champ]: valeur } : o)))

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-lg font-bold">{a.titre}</h2>
          {a.modifie && <span className="rounded-full bg-primaire-doux px-2.5 py-1 text-xs font-bold text-primaire-texte">Version de l’agence</span>}
        </div>
        <Champ libelle="Accroche (première phrase)" aide="[prénom] est remplacé par votre prénom pendant l’appel.">
          <Zone rows={3} value={accroche} onChange={(e) => setAccroche(e.target.value)} />
        </Champ>
        <Champ libelle="Points à aborder (un par ligne)">
          <Zone rows={5} value={points} onChange={(e) => setPoints(e.target.value)} />
        </Champ>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Objections et réponses</h2>
        {objections.map((o, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
            <div className="flex gap-2">
              <Saisie aria-label={`Objection ${i + 1}`} placeholder="Ce que dit la personne…" value={o.objection} onChange={(e) => changerObjection(i, 'objection', e.target.value)} className="flex-1" />
              <button type="button" onClick={() => setObjections(objections.filter((_, j) => j !== i))} className="grid size-12 shrink-0 place-items-center rounded-2xl text-suivi-rouge" aria-label={`Retirer l’objection ${i + 1}`}>
                <Trash2 className="size-5" />
              </button>
            </div>
            <Zone rows={3} aria-label={`Réponse ${i + 1}`} placeholder="Votre réponse…" value={o.reponse} onChange={(e) => changerObjection(i, 'reponse', e.target.value)} />
          </div>
        ))}
        <button type="button" onClick={() => setObjections([...objections, { objection: '', reponse: '' }])} className={`${classesBouton('fantome')} self-start`}>
          <Plus className="size-4" aria-hidden /> Ajouter une objection
        </button>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={enregistrer} className={`${classesBouton('primaire', 'lg')} w-full sm:flex-1`}>
          {enregistre ? <Check className="size-5" aria-hidden /> : null}
          {enregistre ? 'Enregistré pour toute l’équipe' : 'Enregistrer'}
        </button>
        {a.modifie && (
          <button type="button" onClick={retablir} className={`${classesBouton('secondaire', 'lg')} w-full sm:flex-1`}>
            <RotateCcw className="size-5" aria-hidden /> Texte d’origine
          </button>
        )}
      </div>
    </div>
  )
}

/** Argumentaires d'appel par situation, modifiables et partagés avec l'équipe. */
export default function ArgumentairesPage() {
  const [params, setParams] = useSearchParams()
  const cas = (ORDRE_CAS.find((c) => c === params.get('cas')) ?? 'affiche') as CasArgumentaire
  return (
    <>
      <PageHeader titre="Argumentaires" sousTitre="Affichés pendant la session d’appels, selon la situation." />
      <div className="sans-barre -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {ORDRE_CAS.map((c) => (
          <Puce key={c} actif={c === cas} onClick={() => setParams({ cas: c }, { replace: true })}>
            {ARGUMENTAIRES_DEFAUT[c].titre}
          </Puce>
        ))}
      </div>
      <Editeur key={cas} cas={cas} />
    </>
  )
}
