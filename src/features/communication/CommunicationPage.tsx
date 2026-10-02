import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Megaphone, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/data/db'
import { CANAUX_MESSAGE } from '@/domain/communication'
import { ICONE_CANAL, Modeles } from './Modeles'

function Campagnes() {
  const liste = useLiveQuery(async () => {
    const [cs, envois] = await Promise.all([db.campagnes.toArray(), db.envois.toArray()])
    return cs
      .filter((c) => !c.archivedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => {
        const siens = envois.filter((e) => e.campagneId === c.id)
        return { c, envoyes: siens.filter((e) => e.etat === 'envoye').length, restants: siens.filter((e) => e.etat === 'a_envoyer').length, bloques: siens.filter((e) => e.etat === 'bloque').length }
      })
  }, [])
  return (
    <div className="flex flex-col gap-3">
      <Link to="/communication/nouvelle" className={`${classesBouton('primaire')} w-full`}>
        <Plus className="size-5" aria-hidden /> Nouvelle campagne
      </Link>
      {liste && liste.length === 0 ? (
        <EmptyState icone={Megaphone} titre="Aucune campagne">
          Un même message à plusieurs contacts (vœux, nouvelles du marché…), envoyé un par un depuis votre téléphone, uniquement à ceux qui ont donné leur accord.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden !p-0">
          <ul>
            {liste?.map(({ c, envoyes, restants, bloques }) => {
              const Icone = ICONE_CANAL[c.canal]
              return (
                <li key={c.id} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
                  <Link to={`/communication/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                    <Icone className="size-5 shrink-0 text-primaire-texte" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{c.nom}</span>
                      <span className="block text-xs text-doux">
                        {new Date(c.createdAt).toLocaleDateString('fr-BE')} · {CANAUX_MESSAGE.find((x) => x.code === c.canal)!.libelle} · {envoyes} envoyé{envoyes > 1 ? 's' : ''}
                        {restants ? `, ${restants} à envoyer` : ''}
                        {bloques ? `, ${bloques} bloqué${bloques > 1 ? 's' : ''} (RGPD)` : ''}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-doux" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

/** Communication : campagnes (envoi un par un, contrôle RGPD) et modèles de messages. */
export default function CommunicationPage() {
  const [params, setParams] = useSearchParams()
  const onglet = params.get('onglet') === 'modeles' ? 'modeles' : 'campagnes'
  return (
    <>
      <PageHeader titre="Communication" sousTitre="Rien ne part tout seul : chaque message s’ouvre déjà écrit, vous appuyez sur Envoyer." />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
        {(
          [
            ['campagnes', 'Campagnes'],
            ['modeles', 'Modèles'],
          ] as const
        ).map(([code, libelle]) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={onglet === code}
            onClick={() => setParams(code === 'campagnes' ? {} : { onglet: code }, { replace: true })}
            className={`h-11 rounded-xl text-sm font-bold transition ${onglet === code ? 'bg-surface text-primaire-texte shadow-carte' : 'text-doux'}`}
          >
            {libelle}
          </button>
        ))}
      </div>
      {onglet === 'campagnes' ? <Campagnes /> : <Modeles />}
    </>
  )
}
