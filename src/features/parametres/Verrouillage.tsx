import { Lock, ScanFace } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PaveCode } from '@/components/PaveCode'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { confirmer } from '@/components/ui/Confirmation'
import { Feuille } from '@/components/ui/Feuille'
import { codeTropSimple, DELAIS_VERROU, verifierCode } from '@/domain/verrou'
import { activerBiometrie, activerVerrou, biometrieDisponible, changerDelai, desactiverVerrou, retirerBiometrie, useVerrou } from '@/services/verrou'

type Etape = { quoi: 'choisir' } | { quoi: 'confirmer'; code: string } | { quoi: 'actuel'; ensuite: 'changer' | 'retirer' }

/** Choix du code : saisi deux fois ; on vérifie l'ancien code avant de le changer ou de le retirer. */
function SaisieCode({ etape, setEtape, fermer }: { etape: Etape; setEtape: (e: Etape) => void; fermer: () => void }) {
  const { config } = useVerrou()
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState(0)
  const rate = (m: string) => {
    setMessage(m)
    setErreur((e) => e + 1)
  }
  const titre = etape.quoi === 'choisir' ? 'Choisissez un code (4 à 6 chiffres)' : etape.quoi === 'confirmer' ? 'Tapez-le une seconde fois' : 'Tapez votre code actuel'

  const surCode = async (code: string) => {
    if (etape.quoi === 'actuel') {
      if (!config || !(await verifierCode(config, code))) return rate('Code incorrect.')
      setMessage(null)
      if (etape.ensuite === 'retirer') {
        desactiverVerrou()
        fermer()
      } else setEtape({ quoi: 'choisir' })
    } else if (etape.quoi === 'choisir') {
      if (codeTropSimple(code)) return rate('Trop facile à deviner : évitez 1111, 1234…')
      setMessage(null)
      setEtape({ quoi: 'confirmer', code })
    } else if (code !== etape.code) {
      rate('Les deux codes ne correspondent pas. Recommencez.')
      setEtape({ quoi: 'choisir' })
    } else {
      await activerVerrou(code, config?.delaiMinutes ?? 1)
      fermer()
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 pb-2">
      <div className="text-center">
        <p className="font-bold">{titre}</p>
        <p className="min-h-5 text-sm text-suivi-rouge" aria-live="polite">
          {message}
        </p>
      </div>
      <PaveCode key={etape.quoi} longueur={etape.quoi === 'confirmer' ? etape.code.length : etape.quoi === 'actuel' ? config?.longueur : undefined} surCode={surCode} erreur={erreur} />
    </div>
  )
}

export function Verrouillage() {
  const { config } = useVerrou()
  const [etape, setEtape] = useState<Etape | null>(null)
  const [bio, setBio] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => void biometrieDisponible().then(setBio), [])

  const basculerBiometrie = async () => {
    setMessage(null)
    if (config?.biometrie) return retirerBiometrie()
    try {
      await activerBiometrie()
    } catch {
      setMessage('Face ID / empreinte non activé (annulé ou refusé par le téléphone).')
    }
  }

  return (
    <div id="verrouillage" className="scroll-mt-4">
      <Card>
        <SectionTitle>Verrouillage</SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-doux">
          Facultatif. Demande un code{bio ? ' (ou Face ID / l’empreinte)' : ''} pour ouvrir Linkimmo, comme une application bancaire. Le code reste sur cet appareil : chaque téléphone a le sien.
        </p>
        {!config ? (
          <button type="button" onClick={() => setEtape({ quoi: 'choisir' })} className={`${classesBouton('secondaire')} w-full`}>
            <Lock className="size-4" aria-hidden /> Activer le verrouillage
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Verrouiller
              <select value={config.delaiMinutes} onChange={(e) => changerDelai(Number(e.target.value))} className="h-11 rounded-xl bg-surface-2 px-3 text-sm font-semibold">
                {DELAIS_VERROU.map((d) => (
                  <option key={d.minutes} value={d.minutes}>
                    {d.libelle.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            {bio && (
              <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <ScanFace className="size-5 text-primaire-texte" aria-hidden /> Face ID / empreinte
                </span>
                <input type="checkbox" role="switch" checked={!!config.biometrie} onChange={() => void basculerBiometrie()} className="size-5 accent-[var(--color-primaire)]" />
              </label>
            )}
            {message && <p className="text-xs text-suivi-rouge">{message}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEtape({ quoi: 'actuel', ensuite: 'changer' })} className={`${classesBouton('fantome')} flex-1`}>
                Changer le code
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await confirmer({ titre: 'Retirer le verrouillage ?', message: 'Linkimmo s’ouvrira sans code sur cet appareil.', confirmer: 'Continuer' })) setEtape({ quoi: 'actuel', ensuite: 'retirer' })
                }}
                className={`${classesBouton('fantome')} flex-1`}
              >
                Retirer
              </button>
            </div>
          </div>
        )}
      </Card>
      <Feuille ouverte={!!etape} fermer={() => setEtape(null)} titre="Code de verrouillage">
        {etape && <SaisieCode etape={etape} setEtape={setEtape} fermer={() => setEtape(null)} />}
      </Feuille>
    </div>
  )
}
