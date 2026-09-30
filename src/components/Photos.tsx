import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { photos as depotPhotos } from '@/data/repositories/photos'
import type { Photo } from '@/data/types'

/** URL affichable d'une photo (locale, ou téléchargée si absente de l'appareil). */
function useUrlPhoto(id: string | null, miniature: boolean): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return setUrl(null)
    let lien: string | null = null
    let actif = true
    depotPhotos
      .contenu(id, miniature)
      .then((blob) => {
        if (!actif) return
        lien = blob ? URL.createObjectURL(blob) : null
        setUrl(lien)
      })
      .catch(() => actif && setUrl(null))
    return () => {
      actif = false
      if (lien) URL.revokeObjectURL(lien)
    }
  }, [id, miniature])
  return url
}

export function PhotoImage({ id, miniature = true, className = '', alt = '' }: { id: string; miniature?: boolean; className?: string; alt?: string }) {
  const url = useUrlPhoto(id, miniature)
  if (url === undefined) return <div className={`animate-pulse bg-surface-2 ${className}`} />
  if (!url)
    return (
      <div className={`grid place-items-center bg-surface-2 text-doux ${className}`} title="Photo disponible après synchronisation">
        <ImageOff className="size-5" aria-hidden />
      </div>
    )
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />
}

/** Première photo d'un bien (miniature), pour les listes. */
export function VignetteBien({ bienId, className = '' }: { bienId: string; className?: string }) {
  const premiere = useLiveQuery(async () => (await depotPhotos.duBien(bienId))[0] ?? null, [bienId])
  if (premiere === undefined) return <div className={`animate-pulse bg-surface-2 ${className}`} />
  if (!premiere) return null
  return <PhotoImage id={premiere.id} className={className} />
}

/** Galerie : bandeau de miniatures, un appui ouvre la photo en plein écran. */
export function Galerie({ liste }: { liste: Photo[] }) {
  const [ouverte, setOuverte] = useState<number | null>(null)
  if (liste.length === 0) return null
  const courante = ouverte !== null ? liste[ouverte] : null
  return (
    <>
      <div className="sans-barre -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {liste.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOuverte(i)} className="presse shrink-0 snap-start overflow-hidden rounded-2xl" aria-label={`Photo ${i + 1}`}>
            <PhotoImage id={p.id} className={i === 0 ? 'h-44 w-64' : 'h-44 w-32'} />
          </button>
        ))}
      </div>
      {courante && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-label="Photo">
          <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <span className="text-sm font-semibold">
              {ouverte! + 1} / {liste.length} · {new Date(courante.prisLe).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => setOuverte(null)} className="grid size-11 place-items-center rounded-full bg-white/15" aria-label="Fermer">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center">
            <PhotoImage key={courante.id} id={courante.id} miniature={false} className="max-h-full max-w-full !object-contain" />
            {ouverte! > 0 && (
              <button type="button" onClick={() => setOuverte(ouverte! - 1)} className="absolute left-2 grid size-12 place-items-center rounded-full bg-white/15 text-white" aria-label="Photo précédente">
                <ChevronLeft className="size-6" />
              </button>
            )}
            {ouverte! < liste.length - 1 && (
              <button type="button" onClick={() => setOuverte(ouverte! + 1)} className="absolute right-2 grid size-12 place-items-center rounded-full bg-white/15 text-white" aria-label="Photo suivante">
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
