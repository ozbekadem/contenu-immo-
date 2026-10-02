import { Bell, BellOff, Copy, KeyRound, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Puce, Saisie } from '@/components/ui/Champ'
import { PREFERENCES_DEFAUT, type PreferencesNotifications } from '@/domain/rappels'
import { serveurConfigure } from '@/data/sync/supabase'
import { activerNotifications, CLE_VAPID, desactiverNotifications, enregistrerPreferences, lirePreferences, support, useEtatNotifications } from '@/services/notifications'

function Interrupteur({ actif, libelle, changer }: { actif: boolean; libelle: string; changer: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm font-semibold">{libelle}</span>
      <input type="checkbox" role="switch" checked={actif} onChange={(e) => changer(e.target.checked)} className="size-5 accent-[var(--color-primaire)]" />
    </label>
  )
}

const encoder = (octets: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(octets))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Génère la paire de clés des notifications (VAPID) dans le navigateur : rien n'est envoyé nulle part.
 * La clé privée va dans les secrets Supabase ; la clé publique dans la configuration de l'application.
 */
function GenerateurCles() {
  const [cles, setCles] = useState<{ publique: string; privee: string } | null>(null)
  const generer = async () => {
    const paire = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
    const publique = encoder(await crypto.subtle.exportKey('raw', paire.publicKey))
    const privee = (await crypto.subtle.exportKey('jwk', paire.privateKey)).d!
    setCles({ publique, privee })
  }
  return (
    <details className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold">
        <KeyRound className="size-4" aria-hidden /> Mise en place (une seule fois, administrateur)
      </summary>
      <p className="mt-2 text-xs text-doux">
        Génère les deux clés des notifications, sur cet appareil uniquement. Suivez ensuite le guide « Notifications » : la clé privée se colle dans Supabase, la clé publique
        est à m’envoyer.
      </p>
      {!cles ? (
        <button type="button" onClick={generer} className={`${classesBouton('secondaire')} mt-2 h-10 text-xs`}>
          Générer les clés
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {(
            [
              ['Clé publique (VAPID_PUBLIC_KEY)', cles.publique],
              ['Clé privée (VAPID_PRIVATE_KEY) — à garder secrète', cles.privee],
            ] as const
          ).map(([libelle, valeur]) => (
            <div key={libelle}>
              <p className="text-xs font-bold">{libelle}</p>
              <div className="mt-1 flex gap-1">
                <Saisie readOnly value={valeur} aria-label={libelle} className="h-10 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
                <button type="button" onClick={() => void navigator.clipboard?.writeText(valeur)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface" aria-label={`Copier : ${libelle}`}>
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  )
}

/** Paramètres → Notifications : activer, choisir quoi recevoir. */
export function Notifications() {
  const n = useEtatNotifications()
  const [prefs, setPrefs] = useState<PreferencesNotifications>(PREFERENCES_DEFAUT)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => void lirePreferences().then(setPrefs), [])
  const changer = (p: Partial<PreferencesNotifications>) => {
    const suivant = { ...prefs, ...p }
    setPrefs(suivant)
    void enregistrerPreferences(suivant)
  }
  const s = support()

  return (
    <div id="notifications" className="scroll-mt-4">
      <Card>
        <SectionTitle>Notifications</SectionTitle>
        {s === 'installer_iphone' ? (
          <div className="flex items-start gap-3 rounded-2xl bg-primaire-doux p-3 text-sm text-primaire-texte">
            <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              Sur iPhone, les notifications fonctionnent une fois l’application <strong>installée sur l’écran d’accueil</strong>.{' '}
              <Link to="/installer" className="font-bold underline">
                Comment faire
              </Link>
            </p>
          </div>
        ) : s === 'non_supporte' ? (
          <p className="text-sm text-doux">Ce navigateur ne permet pas les notifications. Utilisez Chrome, Edge ou Safari récent.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${n.active && n.permission === 'granted' ? 'bg-suivi-vert/12 text-suivi-vert' : 'bg-surface-2 text-doux'}`}>
                {n.active && n.permission === 'granted' ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
              </span>
              <p className="min-w-0 flex-1 text-xs text-doux">
                {n.active && n.permission === 'granted'
                  ? n.push
                    ? 'Activées sur cet appareil, même application fermée.'
                    : serveurConfigure && CLE_VAPID
                      ? 'Activées. Connectez-vous pour les recevoir aussi application fermée.'
                      : 'Activées pendant que l’application est ouverte. Application fermée : après la mise en place du serveur.'
                  : 'Relances à l’heure prévue, rendez-vous à venir, résumé du matin.'}
              </p>
              {n.active && n.permission === 'granted' ? (
                <button type="button" onClick={() => void desactiverNotifications()} className={`${classesBouton('fantome')} h-10 shrink-0 px-3 text-xs`}>
                  Désactiver
                </button>
              ) : (
                <button
                  type="button"
                  disabled={occupe}
                  onClick={async () => {
                    setOccupe(true)
                    await activerNotifications().catch(() => {})
                    setOccupe(false)
                  }}
                  className={`${classesBouton('primaire')} h-10 shrink-0 px-4 text-sm`}
                >
                  Activer
                </button>
              )}
            </div>
            {n.message && <p className="mt-2 text-xs font-semibold text-suivi-rouge">{n.message}</p>}
          </>
        )}

        <div className="mt-3 divide-y divide-bord/60 border-t border-bord/60 pt-2">
          <Interrupteur libelle="Relances à l’heure prévue" actif={prefs.relances} changer={(v) => changer({ relances: v })} />
          <div className="py-2">
            <p className="text-sm font-semibold">Rappel avant un rendez-vous</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Rappel avant un rendez-vous">
              {[0, 15, 30, 60, 120].map((m) => (
                <Puce key={m} actif={prefs.rdvMinutes === m} onClick={() => changer({ rdvMinutes: m })}>
                  {m === 0 ? 'À l’heure' : m < 60 ? `${m} min` : `${m / 60} h`}
                </Puce>
              ))}
            </div>
          </div>
          <div className="py-1.5">
            <Interrupteur libelle="Résumé du matin" actif={prefs.resumeMatin} changer={(v) => changer({ resumeMatin: v })} />
            {prefs.resumeMatin && (
              <div className="flex items-center gap-2 pb-1">
                <span className="text-xs text-doux">à</span>
                <Saisie type="time" step={900} aria-label="Heure du résumé du matin" value={prefs.heureMatin} onChange={(e) => changer({ heureMatin: e.target.value || '08:30' })} className="h-10 w-32" />
              </div>
            )}
          </div>
          <Interrupteur libelle="Aussi le week-end" actif={prefs.weekEnd} changer={(v) => changer({ weekEnd: v })} />
        </div>
        {!CLE_VAPID && <GenerateurCles />}
      </Card>
    </div>
  )
}
