import { ARGUMENTAIRES_DEFAUT, type Argumentaire, type CasArgumentaire, type ContenuArgumentaire } from '@/domain/argumentaires'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { ArgumentairePerso } from '../types'
import { RepositoryBase } from './base'

/**
 * Argumentaires d'appel : texte d'origine, ou version modifiée par l'agence
 * (synchronisée : toute l'équipe utilise la même).
 */
export class ArgumentaireRepository extends RepositoryBase<ArgumentairePerso> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.argumentaires, 'argumentaires')
  }

  protected deriver(a: ArgumentairePerso): ArgumentairePerso {
    return a
  }

  private async perso(cas: CasArgumentaire): Promise<ArgumentairePerso | undefined> {
    const liste = await this.db.argumentaires.where('cas').equals(cas).toArray()
    // Deux appareils hors ligne ont pu personnaliser le même cas : on garde le plus récent.
    return liste.filter((a) => !a.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  }

  /** Argumentaire à afficher : la version de l'agence si elle existe, sinon le texte d'origine. */
  async pour(cas: CasArgumentaire): Promise<Argumentaire & { modifie: boolean }> {
    const defaut = ARGUMENTAIRES_DEFAUT[cas]
    const p = await this.perso(cas)
    return p ? { ...defaut, accroche: p.accroche, points: p.points, objections: p.objections, modifie: true } : { ...defaut, modifie: false }
  }

  async enregistrer(cas: CasArgumentaire, contenu: ContenuArgumentaire): Promise<void> {
    const propre: ContenuArgumentaire = {
      accroche: contenu.accroche.trim(),
      points: contenu.points.map((p) => p.trim()).filter(Boolean),
      objections: contenu.objections.map((o) => ({ objection: o.objection.trim(), reponse: o.reponse.trim() })).filter((o) => o.objection || o.reponse),
    }
    const p = await this.perso(cas)
    if (p) await this.modifier(p.id, propre)
    else await this.creer({ cas, ...propre })
  }

  /** Revient au texte d'origine (la version modifiée est archivée, jamais effacée). */
  async retablir(cas: CasArgumentaire): Promise<void> {
    for (const a of await this.db.argumentaires.where('cas').equals(cas).toArray()) if (!a.archivedAt) await this.archiver(a.id)
  }
}

export const argumentaires = new ArgumentaireRepository()
