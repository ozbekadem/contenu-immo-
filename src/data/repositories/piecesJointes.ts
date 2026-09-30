import { normaliserUrl, TAILLE_MAX_OCTETS, tailleLisible, titreDepuisNomFichier } from '@/domain/liens'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { EntiteLiee, PieceJointe } from '../types'
import { RepositoryBase } from './base'

let telechargeur: ((p: PieceJointe) => Promise<Blob | undefined>) | null = null

/** Branché par la synchronisation : permet de récupérer un fichier absent de cet appareil. */
export function definirTelechargeur(f: typeof telechargeur): void {
  telechargeur = f
}

export class PieceJointeRepository extends RepositoryBase<PieceJointe> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.piecesJointes, 'piecesJointes')
  }

  protected deriver(p: PieceJointe): PieceJointe {
    return p
  }

  /** Documents et liens d'une fiche, du plus récent au plus ancien (retirés compris). */
  async pour(entite: EntiteLiee, entiteId: string): Promise<PieceJointe[]> {
    const liste = await this.db.piecesJointes.where('[entite+entiteId]').equals([entite, entiteId]).toArray()
    return liste.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async ajouterLien(entite: EntiteLiee, entiteId: string, saisie: { url: string; titre?: string; note?: string }): Promise<PieceJointe> {
    const url = normaliserUrl(saisie.url)
    if (!url) throw new Error('Ce lien ne semble pas valide.')
    const demo = await this.parentEstDemo(entite, entiteId)
    return this.creer({
      entite,
      entiteId,
      type: 'lien',
      titre: saisie.titre?.trim() ?? '',
      note: saisie.note?.trim() ?? '',
      url,
      nomFichier: null,
      mime: null,
      taille: null,
      cheminStockage: null,
    }, { demo })
  }

  /** Enregistre le fichier sur l'appareil (disponible hors ligne) et sa description. */
  async ajouterFichier(entite: EntiteLiee, entiteId: string, fichier: File, note = ''): Promise<PieceJointe> {
    if (fichier.size > TAILLE_MAX_OCTETS) {
      throw new Error(`« ${fichier.name} » est trop volumineux (${tailleLisible(fichier.size)}, maximum ${tailleLisible(TAILLE_MAX_OCTETS)}).`)
    }
    const demo = await this.parentEstDemo(entite, entiteId)
    return this.db.transaction('rw', [this.db.piecesJointes, this.db.fichiers, this.db.journal, this.db.outbox], async () => {
      const piece = await this.creer({
        entite,
        entiteId,
        type: 'fichier',
        titre: titreDepuisNomFichier(fichier.name),
        note: note.trim(),
        url: null,
        nomFichier: fichier.name,
        mime: fichier.type || null,
        taille: fichier.size,
        cheminStockage: null,
      }, { demo })
      await this.db.fichiers.put({ id: piece.id, blob: fichier })
      return piece
    })
  }

  /** Un document joint à une fiche de démonstration reste lui aussi local (jamais synchronisé). */
  private async parentEstDemo(entite: EntiteLiee, entiteId: string): Promise<boolean> {
    if (entite !== 'contacts') return false
    return (await this.db.contacts.get(entiteId))?._demo === true
  }

  override async supprimerDemo(): Promise<number> {
    const ids = (await this.db.piecesJointes.filter((p) => p._demo === true).primaryKeys()) as string[]
    await this.db.fichiers.bulkDelete(ids)
    return super.supprimerDemo()
  }

  /**
   * Contenu du fichier : depuis l'appareil s'il y est, sinon téléchargé depuis le serveur
   * (et gardé ensuite pour la consultation hors ligne).
   */
  async contenu(id: string): Promise<Blob | undefined> {
    const local = (await this.db.fichiers.get(id))?.blob
    if (local || !telechargeur) return local
    const piece = await this.db.piecesJointes.get(id)
    return piece?.cheminStockage ? telechargeur(piece) : undefined
  }
}

export const piecesJointes = new PieceJointeRepository()
