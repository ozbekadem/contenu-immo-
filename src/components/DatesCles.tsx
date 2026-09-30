import { CalendarHeart, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Liste, Saisie } from '@/components/ui/Champ'
import { ecartJours } from '@/domain/dates'
import { relanceAvecDateCle, rappelDateCle, TYPES_DATE_CLE, type DateCle, type TypeDateCle } from '@/domain/prospection'

const dateLisible = (j: string) => {
  const [a, m, d] = j.split('-').map(Number)
  return new Date(a!, m! - 1, d!).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Dates clés (fin de bail, fin de mandat d'une autre agence…) : la relance est automatiquement
 * avancée au bon moment (préavis avant la date).
 */
export function DatesCles({
  dates,
  prochaineRelanceAt,
  enregistrer,
}: {
  dates: DateCle[]
  prochaineRelanceAt: string | null
  enregistrer: (dates: DateCle[], prochaineRelanceAt: string | null) => Promise<unknown>
}) {
  const [ajout, setAjout] = useState(false)
  const [type, setType] = useState<TypeDateCle>('fin_bail')
  const [jour, setJour] = useState('')
  const [note, setNote] = useState('')
  const maintenant = new Date()

  const ajouter = async () => {
    if (!jour) return
    const dc: DateCle = { id: crypto.randomUUID(), type, date: jour, note: note.trim() }
    await enregistrer([...dates, dc].sort((a, b) => a.date.localeCompare(b.date)), relanceAvecDateCle(prochaineRelanceAt, dc, maintenant))
    setAjout(false)
    setJour('')
    setNote('')
  }

  return (
    <Card>
      <SectionTitle
        action={
          !ajout && (
            <button type="button" onClick={() => setAjout(true)} className={`${classesBouton('fantome')} h-9 px-3 text-xs`}>
              <Plus className="size-4" aria-hidden /> Ajouter
            </button>
          )
        }
      >
        Dates clés
      </SectionTitle>
      {dates.length === 0 && !ajout && (
        <p className="text-sm text-doux">Fin de bail, fin du mandat d’une autre agence, départ à la pension… L’application vous relancera au bon moment.</p>
      )}
      <ul className="flex flex-col gap-2">
        {dates.map((dc) => {
          const jours = ecartJours(maintenant, new Date(`${dc.date}T12:00:00`))
          const passee = jours < 0
          return (
            <li key={dc.id} className={`flex items-center gap-3 rounded-2xl bg-surface-2 p-3 ${passee ? 'opacity-60' : ''}`}>
              <CalendarHeart className="size-5 shrink-0 text-primaire-texte" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {TYPES_DATE_CLE[dc.type].libelle} · {dateLisible(dc.date)}
                </div>
                <div className="text-xs text-doux">
                  {passee
                    ? 'date passée'
                    : `dans ${jours} jour${jours > 1 ? 's' : ''} · rappel le ${rappelDateCle(dc, maintenant).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}`}
                  {dc.note && ` · ${dc.note}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => enregistrer(dates.filter((x) => x.id !== dc.id), prochaineRelanceAt)}
                className="grid size-10 place-items-center rounded-full text-doux"
                aria-label={`Retirer ${TYPES_DATE_CLE[dc.type].libelle}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
      {ajout && (
        <div className="mt-2 flex flex-col gap-3 rounded-3xl bg-primaire-doux/60 p-4">
          <Champ libelle="Type">
            <Liste value={type} onChange={(e) => setType(e.target.value as TypeDateCle)}>
              {(Object.keys(TYPES_DATE_CLE) as TypeDateCle[]).map((t) => (
                <option key={t} value={t}>
                  {TYPES_DATE_CLE[t].libelle}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ libelle="Date" aide={`Rappel automatique ${TYPES_DATE_CLE[type].preavisJours} jours avant.`}>
            <Saisie type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
          </Champ>
          <Champ libelle="Précision (facultatif)">
            <Saisie value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. locataire prévenu, préavis donné" />
          </Champ>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAjout(false)} className={`${classesBouton('secondaire')} h-12 flex-1 rounded-2xl`}>
              Annuler
            </button>
            <button type="button" disabled={!jour} onClick={ajouter} className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}>
              Ajouter la date
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
