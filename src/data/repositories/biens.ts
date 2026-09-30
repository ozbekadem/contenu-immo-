import { cleAdresse } from '@/domain/adresse'
import { distanceMetres } from '@/domain/prospection'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import { deriverBien } from '../derives'
import type { Adresse, Bien } from '../types'
import { RepositoryBase, type Donnees } from './base'

export type DonneesBien = Donnees<Bien>

export function bienVide(): DonneesBien {
  return { adresse: null, lat: null, lng: null, precisionGps: null, adresseAChercher: false, type: null, facades: null, chambres: null, notes: '' }
}

/** Distance en dessous de laquelle deux repérages sont probablement le même bien. */
export const RAYON_MEME_BIEN_M = 25

export class BienRepository extends RepositoryBase<Bien> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.biens, 'biens')
  }

  protected deriver(b: Bien): Bien {
    return deriverBien(b)
  }

  /** Biens existants qui pourraient être le même : même adresse, ou à moins de 25 m. */
  async similaires(adresse: Adresse | null, position: { lat: number; lng: number } | null, exclureId?: string): Promise<{ bien: Bien; raison: 'adresse' | 'proximite'; distance?: number }[]> {
    const resultats: { bien: Bien; raison: 'adresse' | 'proximite'; distance?: number }[] = []
    const cle = cleAdresse(adresse)
    if (cle) for (const b of await this.db.biens.where('_cleAdresse').equals(cle).toArray()) if (b.id !== exclureId) resultats.push({ bien: b, raison: 'adresse' })
    if (position) {
      const tous = await this.db.biens.filter((b) => b.lat != null && b.lng != null && b.id !== exclureId).toArray()
      for (const b of tous) {
        if (resultats.some((r) => r.bien.id === b.id)) continue
        const d = distanceMetres(position, { lat: b.lat!, lng: b.lng! })
        if (d <= RAYON_MEME_BIEN_M) resultats.push({ bien: b, raison: 'proximite', distance: Math.round(d) })
      }
    }
    return resultats
  }
}

export const biens = new BienRepository()
