import { useRegisterSW } from 'virtual:pwa-register/react'

/** Propose de recharger quand une nouvelle version de l'application est disponible. */
export function UpdatePrompt() {
  const {
    needRefresh: [besoin, setBesoin],
    updateServiceWorker,
  } = useRegisterSW()

  if (!besoin) return null
  return (
    <div className="fixed inset-x-4 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-3 pl-4 text-sm text-white shadow-xl lg:bottom-6">
      <span className="flex-1">Nouvelle version disponible.</span>
      <button className="rounded-full px-3 py-2 text-white/70" onClick={() => setBesoin(false)}>
        Plus tard
      </button>
      <button className="rounded-full bg-accent px-4 py-2 font-bold text-accent-ink" onClick={() => updateServiceWorker(true)}>
        Mettre à jour
      </button>
    </div>
  )
}
