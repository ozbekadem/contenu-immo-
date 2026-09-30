import { LogOut, MonitorSmartphone, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/auth'
import { IndicateurSync } from '@/components/IndicateurSync'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { appareil as idAppareil } from '@/data/appareil'
import { synchroniserMaintenant, useEtatSync } from '@/data/sync/service'
import { supabase } from '@/data/sync/supabase'

interface LigneAppareil {
  user_id: string
  id: string
  nom: string
  derniere_activite: string
  revoque: boolean
}

const ROLES = { admin: 'Administrateur', collaborateur: 'Collaborateur', stagiaire: 'Stagiaire' } as const

const quand = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais'

function Appareils({ estAdmin }: { estAdmin: boolean }) {
  const [liste, setListe] = useState<LigneAppareil[] | null>(null)
  const [noms, setNoms] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const { data, error } = await supabase().from('appareils').select('*').order('derniere_activite', { ascending: false })
      if (error) throw error
      setListe(data as LigneAppareil[])
      if (estAdmin) {
        const { data: profils } = await supabase().from('profils').select('id, nom, email')
        setNoms(Object.fromEntries((profils ?? []).map((p) => [p.id, p.nom || p.email])))
      }
    } catch {
      setErreur('Liste des appareils disponible uniquement avec Internet.')
    }
  }, [estAdmin])

  useEffect(() => {
    void charger()
  }, [charger])

  const revoquer = async (a: LigneAppareil) => {
    if (!confirm(`Déconnecter « ${a.nom} » à distance ?\nSes données locales seront effacées dès qu’il se reconnectera à Internet.`)) return
    await supabase().from('appareils').update({ revoque: true, revoque_le: new Date().toISOString() }).eq('user_id', a.user_id).eq('id', a.id)
    await charger()
  }

  if (erreur) return <p className="text-sm text-doux">{erreur}</p>
  if (!liste) return <p className="text-sm text-doux">Chargement…</p>
  return (
    <ul className="flex flex-col gap-2">
      {liste.map((a) => (
        <li key={`${a.user_id}/${a.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <MonitorSmartphone className="size-5 shrink-0 text-doux" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {a.nom}
              {a.id === idAppareil && <span className="font-medium text-primaire-texte"> · cet appareil</span>}
            </div>
            <div className="truncate text-xs text-doux">
              {estAdmin && noms[a.user_id] ? `${noms[a.user_id]} · ` : ''}
              {a.revoque ? 'déconnecté à distance' : `actif ${quand(a.derniere_activite)}`}
            </div>
          </div>
          {!a.revoque && a.id !== idAppareil && (
            <button type="button" onClick={() => revoquer(a)} className={`${classesBouton('danger')} h-9 px-3 text-xs`}>
              Déconnecter
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function CompteSync() {
  const { etat, profil, deconnecter } = useAuth()
  const sync = useEtatSync()
  const [synchro, setSynchro] = useState(false)

  if (etat.etape === 'local') {
    return (
      <Card>
        <div id="compte" className="scroll-mt-24" />
        <SectionTitle action={<IndicateurSync avecTexte />}>Compte et synchronisation</SectionTitle>
        <p className="text-sm text-doux">
          L’application fonctionne en <strong className="text-texte">mode local</strong> : vos données restent sur cet appareil. La synchronisation
          entre appareils et collaborateurs s’activera dès que le serveur sera configuré.
        </p>
      </Card>
    )
  }
  if (etat.etape !== 'connecte') return null

  return (
    <Card>
      <div id="compte" className="scroll-mt-24" />
      <SectionTitle action={<IndicateurSync avecTexte />}>Compte et synchronisation</SectionTitle>
      <div className="rounded-2xl bg-surface-2 p-3 text-sm">
        <div className="font-bold">{profil?.nom || etat.session.user.email}</div>
        <div className="text-doux">
          {etat.session.user.email}
          {profil && ` · ${ROLES[profil.role]}`}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="text-xs font-semibold text-doux">Dernière synchro</div>
          <div className="font-bold">{quand(sync.derniere)}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="text-xs font-semibold text-doux">En attente d’envoi</div>
          <div className="font-bold">{sync.enAttente} modification{sync.enAttente > 1 ? 's' : ''}</div>
        </div>
      </div>
      {sync.erreur && <p className="mt-2 rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">{sync.erreur}</p>}
      <button
        type="button"
        disabled={synchro}
        onClick={async () => {
          setSynchro(true)
          await synchroniserMaintenant()
          setSynchro(false)
        }}
        className={`${classesBouton('fantome')} mt-3 h-12 w-full rounded-2xl`}
      >
        <RefreshCw className={`size-4 ${synchro ? 'animate-spin' : ''}`} aria-hidden /> Synchroniser maintenant
      </button>

      <h3 className="mb-2 mt-5 text-sm font-bold">{profil?.role === 'admin' ? 'Appareils de l’agence' : 'Mes appareils'}</h3>
      <Appareils estAdmin={profil?.role === 'admin'} />
      <p className="mt-2 text-xs text-doux">Téléphone perdu ? Déconnectez-le ici : ses données seront effacées dès qu’il se connecte à Internet.</p>

      <button type="button" onClick={deconnecter} className={`${classesBouton('danger')} mt-4 h-12 w-full rounded-2xl`}>
        <LogOut className="size-4" aria-hidden /> Se déconnecter de cet appareil
      </button>
    </Card>
  )
}
