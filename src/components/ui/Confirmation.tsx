import { useEffect, useState } from 'react'
import { classesBouton } from './Bouton'

export interface DemandeConfirmation {
  titre: string
  message?: string
  /** Libellé du bouton de confirmation (« Archiver », « Quitter »…). */
  confirmer?: string
  annuler?: string
  danger?: boolean
}

type EnAttente = DemandeConfirmation & { repondre: (ok: boolean) => void }

let afficher: ((d: EnAttente) => void) | null = null

/**
 * Demande une confirmation dans une fenêtre intégrée à l'application
 * (identique sur iPhone, Android et ordinateur). Résout `true` si l'utilisateur confirme.
 */
export function confirmer(demande: DemandeConfirmation): Promise<boolean> {
  return new Promise((resolve) => {
    if (!afficher) return resolve(window.confirm([demande.titre, demande.message].filter(Boolean).join('\n')))
    afficher({ ...demande, repondre: resolve })
  })
}

/** À placer une fois à la racine de l'application. */
export function ZoneConfirmation() {
  const [demande, setDemande] = useState<EnAttente | null>(null)

  useEffect(() => {
    afficher = setDemande
    return () => {
      afficher = null
    }
  }, [])

  useEffect(() => {
    if (!demande) return
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && repondre(false)
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  })

  if (!demande) return null
  const repondre = (ok: boolean) => {
    demande.repondre(ok)
    setDemande(null)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-titre">
      <button type="button" aria-label="Annuler" onClick={() => repondre(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-sm animate-apparition rounded-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-flottant">
        <h2 id="confirmation-titre" className="text-lg font-extrabold leading-snug">
          {demande.titre}
        </h2>
        {demande.message && <p className="mt-2 whitespace-pre-line text-sm text-doux">{demande.message}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={() => repondre(false)} className={`${classesBouton('fantome')} h-12 w-full rounded-2xl sm:flex-1`}>
            {demande.annuler ?? 'Annuler'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => repondre(true)}
            className={`${demande.danger ? 'bg-suivi-rouge text-white presse inline-flex items-center justify-center font-bold' : classesBouton('primaire')} h-12 w-full rounded-2xl sm:flex-1`}
          >
            {demande.confirmer ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
