import type { PhotoCompressee } from '@/data/repositories/photos'
import { dimensionsReduites } from '@/domain/prospection'

const TAILLE_MAX = 1600
const TAILLE_MINIATURE = 400

async function versBlob(source: ImageBitmap, largeur: number, hauteur: number, qualite: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  canvas.getContext('2d')!.drawImage(source, 0, 0, largeur, hauteur)
  const essayer = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, qualite))
  // WebP (plus léger) ; les iPhone plus anciens ne savent pas l'encoder : JPEG à la place.
  const webp = await essayer('image/webp')
  if (webp && webp.type === 'image/webp') return webp
  return (await essayer('image/jpeg'))!
}

/**
 * Compresse une photo sur l'appareil avant tout envoi : 1600 px maximum (≈ 200-400 Ko)
 * + une miniature de 400 px pour les listes. L'orientation de l'appareil photo est respectée.
 */
export async function compresserPhoto(fichier: File): Promise<PhotoCompressee> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  try {
    const grande = dimensionsReduites(image.width, image.height, TAILLE_MAX)
    const petite = dimensionsReduites(image.width, image.height, TAILLE_MINIATURE)
    const [blob, miniature] = await Promise.all([
      versBlob(image, grande.largeur, grande.hauteur, 0.8),
      versBlob(image, petite.largeur, petite.hauteur, 0.7),
    ])
    return { image: blob, miniature, largeur: grande.largeur, hauteur: grande.hauteur }
  } finally {
    image.close()
  }
}
