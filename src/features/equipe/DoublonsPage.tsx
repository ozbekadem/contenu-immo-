import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, CopyCheck, Merge } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { confirmer } from '@/components/ui/Confirmation'
import { EmptyState } from '@/components/ui/EmptyState'
import { db } from '@/data/db'
import { fusionnerContacts } from '@/data/repositories/fusion'
import type { Contact } from '@/data/types'
import { empreinte, LIBELLE_RAISON } from '@/domain/doublons'
import { pairesDoublons } from '@/domain/fusion'
import { formaterTelephone } from '@/domain/telephone'
import { nomAffiche } from '@/features/contacts/affichage'

const CLE_ECARTES = 'doublons.ecartes'

function Resume({ c, echanges, garder, choisi }: { c: Contact; echanges: number; garder: () => void; choisi: boolean }) {
  return (
    <button type="button" onClick={garder} aria-pressed={choisi} className={`min-w-0 flex-1 rounded-2xl p-3 text-left ring-2 transition ${choisi ? 'bg-primaire-doux ring-primaire' : 'bg-surface-2 ring-transparent'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-primaire-texte">{choisi ? 'Fiche gardée' : 'Garder celle-ci'}</p>
      <Link to={`/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="mt-0.5 block truncate font-bold underline-offset-2 hover:underline">
        {nomAffiche(c)}
      </Link>
      <p className="mt-1 truncate text-xs text-doux">{c.telephones.map((t) => formaterTelephone(t.numero)).join(', ') || 'sans téléphone'}</p>
      <p className="truncate text-xs text-doux">{c.emails.join(', ') || 'sans email'}</p>
      <p className="mt-1 text-xs text-doux">
        {echanges} échange{echanges > 1 ? 's' : ''} · créée le {new Date(c.createdAt).toLocaleDateString('fr-BE')}
      </p>
    </button>
  )
}

/** Doublons : fiches probablement identiques, à fusionner en une seule (rien n'est perdu, rien n'est effacé). */
export default function DoublonsPage() {
  const navigate = useNavigate()
  const donnees = useLiveQuery(async () => {
    const [contacts, interactions, ecartes] = await Promise.all([db.contacts.filter((c) => !c.archivedAt).toArray(), db.interactions.toArray(), db.meta.get(CLE_ECARTES)])
    const echanges = new Map<string, number>()
    for (const i of interactions) if (i.contactId && !i.archivedAt) echanges.set(i.contactId, (echanges.get(i.contactId) ?? 0) + 1)
    return { contacts, echanges, ecartes: new Set((ecartes?.valeur as string[] | undefined) ?? []) }
  }, [])
  const [choix, setChoix] = useState<Record<string, string>>({})
  const [occupe, setOccupe] = useState<string | null>(null)

  const paires = useMemo(() => {
    if (!donnees) return null
    return pairesDoublons(donnees.contacts.map((c) => ({ fiche: c, empreinte: c._empreinte ?? empreinte(c) })))
      .map((p) => ({ ...p, cle: [p.a.id, p.b.id].sort().join('|') }))
      .filter((p) => !donnees.ecartes.has(p.cle))
  }, [donnees])

  if (!paires || !donnees) return null
  const ecarter = async (cle: string) => db.meta.put({ cle: CLE_ECARTES, valeur: [...donnees.ecartes, cle] })
  const fusionner = async (garde: Contact, autre: Contact, cle: string) => {
    const ok = await confirmer({
      titre: 'Fusionner ces deux fiches ?',
      message: `« ${nomAffiche(garde)} » est gardée et complétée (téléphones, emails, notes, historique, pistes, rendez-vous, documents). « ${nomAffiche(autre)} » est archivée, jamais effacée.`,
      confirmer: 'Fusionner',
    })
    if (!ok) return
    setOccupe(cle)
    await fusionnerContacts(garde.id, autre.id)
    setOccupe(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Doublons</h1>
          <p className="text-xs font-semibold text-doux">{paires.length ? `${paires.length} paire${paires.length > 1 ? 's' : ''} à vérifier` : 'Aucun doublon détecté'}</p>
        </div>
      </div>
      {paires.length === 0 ? (
        <EmptyState icone={CopyCheck} titre="Aucun doublon">
          Même téléphone, même email ou même nom : l’application vous préviendra ici.
        </EmptyState>
      ) : (
        paires.map((p) => {
          // Par défaut : on garde la fiche la plus riche (le plus d'échanges), sinon la plus ancienne.
          const defaut = (donnees.echanges.get(p.a.id) ?? 0) !== (donnees.echanges.get(p.b.id) ?? 0) ? ((donnees.echanges.get(p.a.id) ?? 0) > (donnees.echanges.get(p.b.id) ?? 0) ? p.a : p.b) : p.a.createdAt <= p.b.createdAt ? p.a : p.b
          const gardeId = choix[p.cle] ?? defaut.id
          const garde = gardeId === p.a.id ? p.a : p.b
          const autre = garde === p.a ? p.b : p.a
          return (
            <Card key={p.cle} className="flex flex-col gap-3">
              <p className="text-xs font-bold text-suivi-orange">{p.raisons.map((r) => LIBELLE_RAISON[r]).join(' · ')}</p>
              <div className="flex gap-2">
                <Resume c={p.a} echanges={donnees.echanges.get(p.a.id) ?? 0} choisi={garde === p.a} garder={() => setChoix({ ...choix, [p.cle]: p.a.id })} />
                <Resume c={p.b} echanges={donnees.echanges.get(p.b.id) ?? 0} choisi={garde === p.b} garder={() => setChoix({ ...choix, [p.cle]: p.b.id })} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void ecarter(p.cle)} className={`${classesBouton('fantome')} h-11 flex-1 text-xs`}>
                  Ce ne sont pas les mêmes
                </button>
                <button type="button" disabled={occupe === p.cle} onClick={() => void fusionner(garde, autre, p.cle)} className={`${classesBouton('primaire')} h-11 flex-1 text-sm`}>
                  <Merge className="size-4" aria-hidden /> Fusionner
                </button>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
