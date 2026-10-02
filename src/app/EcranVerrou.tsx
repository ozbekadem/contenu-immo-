import { Lock, ScanFace } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PaveCode } from '@/components/PaveCode'
import { confirmer } from '@/components/ui/Confirmation'
import { db } from '@/data/db'
import { ESSAIS_LIBRES } from '@/domain/verrou'
import { deverrouillerBiometrie, desactiverVerrou, essayerCode, tentatives, useVerrou } from '@/services/verrou'
import { useAuth } from './auth'

/** Écran de verrouillage : recouvre toute l'application tant que le code (ou Face ID / l'empreinte) n'est pas donné. */
export function EcranVerrou() {
  const { config, verrouille } = useVerrou()
  const { etat, deconnecter } = useAuth()
  const [erreur, setErreur] = useState(0)
  const [maintenant, setMaintenant] = useState(Date.now())
  const essaiAuto = useRef(false)
  const bloqueJusque = verrouille ? tentatives().bloqueJusque : 0
  const attente = Math.max(0, Math.ceil((bloqueJusque - maintenant) / 1000))

  useEffect(() => {
    if (!attente) return
    const t = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(t)
  }, [attente])

  // Propose Face ID / l'empreinte dès l'affichage (une fois par verrouillage).
  useEffect(() => {
    if (!verrouille) {
      essaiAuto.current = false
      return
    }
    if (config?.biometrie && !essaiAuto.current && document.visibilityState === 'visible') {
      essaiAuto.current = true
      void deverrouillerBiometrie()
    }
  }, [verrouille, config?.biometrie])

  if (!config || !verrouille) return null

  const essayer = async (code: string) => {
    if (!(await essayerCode(code))) {
      setErreur((e) => e + 1)
      setMaintenant(Date.now())
    }
  }

  const oublie = async () => {
    if (etat.etape === 'connecte') {
      // Les données sont sur le serveur : se déconnecter efface cet appareil, on les retrouve en se reconnectant.
      await deconnecter()
      return
    }
    const ok = await confirmer({
      titre: 'Effacer les données de cet appareil ?',
      message: 'Sans le code, la seule solution est de tout effacer sur cet appareil. Les fiches qui ne sont pas sur le serveur ou dans une sauvegarde seront perdues.',
      confirmer: 'Tout effacer',
      danger: true,
    })
    if (!ok) return
    db.close()
    await db.delete()
    desactiverVerrou()
    location.replace('/')
  }

  const { echecs } = tentatives()
  return (
    <div role="dialog" aria-modal="true" aria-label="Application verrouillée" className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-8 overflow-y-auto bg-fond px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="degrade grid size-14 place-items-center rounded-2xl text-white shadow-primaire">
          <Lock className="size-7" aria-hidden />
        </span>
        <h1 className="mt-2 text-xl font-extrabold">Linkimmo est verrouillé</h1>
        <p className="min-h-5 text-sm text-doux" aria-live="polite">
          {attente
            ? `Trop d’essais. Réessayez dans ${attente >= 60 ? `${Math.ceil(attente / 60)} min` : `${attente} s`}.`
            : echecs
              ? `Code incorrect${echecs < ESSAIS_LIBRES ? ` (${ESSAIS_LIBRES - echecs} essai${ESSAIS_LIBRES - echecs > 1 ? 's' : ''} avant une attente)` : ''}.`
              : 'Tapez votre code.'}
        </p>
      </div>
      <PaveCode
        longueur={config.longueur}
        surCode={essayer}
        desactive={attente > 0}
        erreur={erreur}
        toucheGauche={
          config.biometrie ? (
            <button type="button" onClick={() => void deverrouillerBiometrie()} className="presse grid size-16 place-items-center rounded-full text-primaire-texte" aria-label="Déverrouiller avec Face ID ou l’empreinte">
              <ScanFace className="size-8" aria-hidden />
            </button>
          ) : null
        }
      />
      <button type="button" onClick={() => void oublie()} className="text-sm font-bold text-primaire-texte">
        Code oublié ?
      </button>
    </div>
  )
}
