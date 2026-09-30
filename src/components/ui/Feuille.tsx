import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Panneau qui monte du bas de l'écran (utilisable à une main). */
export function Feuille({ titre, ouverte, fermer, children }: { titre: string; ouverte: boolean; fermer: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!ouverte) return
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fermer()
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [ouverte, fermer])

  if (!ouverte) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" onClick={fermer} className="absolute inset-0 animate-[apparition_150ms_ease-out] bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg animate-apparition rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-flottant sm:rounded-[28px]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-bord sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{titre}</h2>
          <button type="button" onClick={fermer} className="grid size-10 place-items-center rounded-full bg-surface-2" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
