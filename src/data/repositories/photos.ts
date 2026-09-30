import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { Photo } from '../types'
import { RepositoryBase } from './base'

export interface PhotoCompressee {
  image: Blob
  miniature: Blob
  largeur: number
  hauteur: number
}

let telechargeurPhoto: ((p: Photo, miniature: boolean) => Promise<Blob | undefined>) | null = null

/** Branché par la synchronisation : récupère une photo absente de cet appareil. */
export function definirTelechargeurPhoto(f: typeof telechargeurPhoto): void {
  telechargeurPhoto = f
}

export class PhotoRepository extends RepositoryBase<Photo> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.photos, 'photos')
  }

  protected deriver(p: Photo): Photo {
    return p
  }

  /** Enregistre des photos déjà compressées (contenu gardé sur l'appareil, description synchronisée). */
  async ajouter(bienId: string, pisteId: string | null, photos: PhotoCompressee[], options: { demo?: boolean } = {}): Promise<Photo[]> {
    return this.db.transaction('rw', [this.db.photos, this.db.photosLocales, this.db.journal, this.db.outbox], async () => {
      const maintenant = new Date().toISOString()
      const fiches = await this.creerPlusieurs(
        photos.map((p) => ({
          bienId,
          pisteId,
          largeur: p.largeur,
          hauteur: p.hauteur,
          prisLe: maintenant,
          cheminStockage: null,
          miniatureStockage: null,
        })),
        { demo: options.demo, journaliser: false },
      )
      await this.db.photosLocales.bulkPut(fiches.map((f, i) => ({ id: f.id, image: photos[i]!.image, miniature: photos[i]!.miniature })))
      return fiches
    })
  }

  async duBien(bienId: string): Promise<Photo[]> {
    const liste = await this.db.photos.where('bienId').equals(bienId).toArray()
    return liste.filter((p) => !p.archivedAt).sort((a, b) => a.prisLe.localeCompare(b.prisLe))
  }

  /** Contenu d'une photo (miniature ou pleine taille) : local, sinon téléchargé et gardé. */
  async contenu(id: string, miniature: boolean): Promise<Blob | undefined> {
    const local = await this.db.photosLocales.get(id)
    const blob = miniature ? (local?.miniature ?? local?.image) : (local?.image ?? local?.miniature)
    if (blob || !telechargeurPhoto) return blob ?? undefined
    const photo = await this.db.photos.get(id)
    if (!photo) return undefined
    return telechargeurPhoto(photo, miniature)
  }
}

export const photos = new PhotoRepository()
