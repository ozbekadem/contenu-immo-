import { useRegisterSW } from 'virtual:pwa-register/react'

/** Propose de recharger quand une nouvelle version de l'application est disponible. */
export function UpdatePrompt() {
  const {
    needRefresh: [besoin, setBesoin],
    updateServiceWorker,
  } = useRegisterSW()

  if (!besoin) return null
  return (
    <div className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md animate-apparition items-center gap-2 rounded-3xl bg-surface p-2 pl-4 text-sm shadow-flottant ring-1 ring-bord">
      <span className="flex-1 font-semibold">Nouvelle version disponible</span>
      <button className="h-10 rounded-full px-3 font-semibold text-doux" onClick={() => setBesoin(false)}>
        Plus tard
      </button>
      <button className="degrade h-10 rounded-full px-4 font-bold text-white" onClick={() => updateServiceWorker(true)}>
        Mettre à jour
      </button>
    </div>
  )
}
