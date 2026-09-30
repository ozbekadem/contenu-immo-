import type { Table } from 'dexie'
import type { Horloge } from '@/domain/hlc'
import type { LinkimmoDB } from '../db'
import type { EntreeJournal, Enregistrement, PieceJointe } from '../types'
import type { JournalServeur, LigneServeur, Transport } from './transport'

export type StatutSync = 'local' | 'hors_ligne' | 'en_cours' | 'a_jour' | 'erreur' | 'revoque'

export interface EtatSync {
  statut: StatutSync
  /** Modifications locales pas encore envoyées. */
  enAttente: number
  derniere: string | null
  erreur: string | null
}

export interface ConfigEntite {
  table: (db: LinkimmoDB) => Table<Enregistrement, string>
  deriver: (fiche: Enregistrement) => Enregistrement
}

const LOT = 200
const CLE_CURSEUR = 'sync.curseur'
const CLE_CURSEUR_JOURNAL = 'sync.curseurJournal'

/**
 * Moteur de synchronisation « local-first » :
 * 1. envoie la file des modifications locales (fusion champ par champ côté serveur) ;
 * 2. envoie le journal ;
 * 3. reçoit tout ce qui a changé depuis la dernière fois et le fusionne champ par champ ;
 * 4. envoie les fichiers joints en attente.
 * Une seule synchronisation à la fois ; une demande pendant l'exécution relance un tour.
 */
export class MoteurSync {
  private enCours: Promise<void> | null = null
  private redemander = false
  private etat: EtatSync = { statut: 'a_jour', enAttente: 0, derniere: null, erreur: null }
  private abonnes = new Set<(e: EtatSync) => void>()

  constructor(
    private readonly db: LinkimmoDB,
    private readonly transport: Transport,
    private readonly entites: Record<string, ConfigEntite>,
    private readonly horloge: Horloge,
    private readonly appareil: { id: string; nom: string },
    private readonly surRevoque: () => void = () => {},
  ) {}

  obtenirEtat(): EtatSync {
    return this.etat
  }

  abonner(f: (e: EtatSync) => void): () => void {
    this.abonnes.add(f)
    return () => this.abonnes.delete(f)
  }

  private publier(patch: Partial<EtatSync>) {
    this.etat = { ...this.etat, ...patch }
    for (const f of this.abonnes) f(this.etat)
  }

  /** Lance une synchronisation (ou en programme une nouvelle si une est déjà en cours). */
  synchroniser(): Promise<void> {
    if (this.enCours) {
      this.redemander = true
      return this.enCours
    }
    this.enCours = (async () => {
      try {
        do {
          this.redemander = false
          await this.tour()
        } while (this.redemander)
      } finally {
        this.enCours = null
      }
    })()
    return this.enCours
  }

  private async tour() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.publier({ statut: 'hors_ligne', enAttente: await this.db.outbox.count() })
      return
    }
    this.publier({ statut: 'en_cours', erreur: null })
    try {
      const { revoque } = await this.transport.signalerAppareil(this.appareil.id, this.appareil.nom)
      if (revoque) {
        this.publier({ statut: 'revoque' })
        this.surRevoque()
        return
      }
      await this.envoyerModifications()
      await this.envoyerJournal()
      await this.recevoir()
      await this.recevoirJournal()
      if (await this.envoyerFichiers()) await this.envoyerModifications()
      this.publier({ statut: 'a_jour', enAttente: await this.db.outbox.count(), derniere: new Date().toISOString() })
    } catch (e) {
      const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false
      this.publier({
        statut: horsLigne ? 'hors_ligne' : 'erreur',
        erreur: horsLigne ? null : (e as Error).message,
        enAttente: await this.db.outbox.count(),
      })
    }
  }

  private async envoyerModifications() {
    for (;;) {
      const ops = await this.db.outbox.orderBy('seq').limit(LOT).toArray()
      if (ops.length === 0) return
      await this.transport.push(
        ops.map((o) => ({ entite: o.table, id: o.rowId, champs: o.champs, ts: o.ts })),
        this.appareil.id,
      )
      // Les champs refusés (plus anciens que la version du serveur) reviendront à la réception
      // et le serveur a inscrit la valeur perdante au journal.
      await this.db.outbox.bulkDelete(ops.map((o) => o.seq!))
      this.publier({ enAttente: await this.db.outbox.count() })
    }
  }

  private async envoyerJournal() {
    for (;;) {
      const entrees = await this.db.journal.where('envoye').equals(0).limit(LOT).toArray()
      if (entrees.length === 0) return
      await this.transport.pushJournal(
        entrees.map((e) => ({
          id: e.uid,
          entite: e.table,
          row_id: e.rowId,
          champ: e.champ,
          avant: e.avant ?? null,
          apres: e.apres ?? null,
          auteur: e.auteur,
          appareil: e.appareil,
          at: e.at,
          conflit: !!e.conflit,
        })),
      )
      await this.db.journal.bulkUpdate(entrees.map((e) => ({ key: e.id!, changes: { envoye: 1 as const } })))
    }
  }

  private async recevoir() {
    let curseur = ((await this.db.meta.get(CLE_CURSEUR))?.valeur as number | undefined) ?? 0
    for (;;) {
      const lignes = await this.transport.pull(curseur, LOT)
      if (lignes.length === 0) return
      await this.appliquer(lignes)
      curseur = lignes[lignes.length - 1]!.server_seq
      await this.db.meta.put({ cle: CLE_CURSEUR, valeur: curseur })
      if (lignes.length < LOT) return
    }
  }

  /** Fusion champ par champ : le champ le plus récent gagne, les modifications locales en attente sont préservées. */
  private async appliquer(lignes: LigneServeur[]) {
    const tables = [...new Set(lignes.map((l) => this.entites[l.entite]).filter(Boolean).map((c) => c!.table(this.db)))]
    await this.db.transaction('rw', tables, async () => {
      for (const l of lignes) {
        const config = this.entites[l.entite]
        if (!config) continue // entité d'une version plus récente de l'application : ignorée
        const table = config.table(this.db)
        const locale = await table.get(l.id)
        const fiche: Record<string, unknown> = locale
          ? { ...locale }
          : { id: l.id, createdAt: l.created_at, createdBy: l.created_by, archivedAt: null, _ts: {} }
        const ts: Record<string, string> = { ...((fiche._ts as Record<string, string>) ?? {}) }
        let change = !locale

        for (const [champ, valeur] of Object.entries(l.donnees)) {
          const tsServeur = l.ts[champ]
          if (!tsServeur) continue
          this.horloge.recevoir(tsServeur)
          const tsLocal = ts[champ]
          if (!tsLocal || tsServeur > tsLocal) {
            fiche[champ] = valeur
            ts[champ] = tsServeur
            change = true
          }
        }
        if (!change) continue
        fiche._ts = ts
        fiche.updatedAt = l.updated_at
        fiche.updatedBy = l.updated_by
        await table.put(config.deriver(fiche as unknown as Enregistrement))
      }
    })
  }

  private async recevoirJournal() {
    let curseur = ((await this.db.meta.get(CLE_CURSEUR_JOURNAL))?.valeur as number | undefined) ?? 0
    for (;;) {
      const entrees: JournalServeur[] = await this.transport.pullJournal(curseur, LOT)
      if (entrees.length === 0) return
      const connus = new Set((await this.db.journal.where('uid').anyOf(entrees.map((e) => e.id)).toArray()).map((e) => e.uid))
      const nouvelles: EntreeJournal[] = entrees
        .filter((e) => !connus.has(e.id))
        .map((e) => ({
          uid: e.id,
          envoye: 1,
          table: e.entite,
          rowId: e.row_id,
          champ: e.champ,
          avant: e.avant,
          apres: e.apres,
          auteur: e.auteur,
          appareil: e.appareil ?? '',
          at: e.at,
          conflit: e.conflit,
        }))
      if (nouvelles.length) await this.db.journal.bulkAdd(nouvelles)
      curseur = entrees[entrees.length - 1]!.server_seq
      await this.db.meta.put({ cle: CLE_CURSEUR_JOURNAL, valeur: curseur })
      if (entrees.length < LOT) return
    }
  }

  /** Envoie les fichiers joints pas encore stockés sur le serveur. Retourne true si des fiches ont changé. */
  private async envoyerFichiers(): Promise<boolean> {
    const aEnvoyer = await this.db.piecesJointes
      .filter((p) => p.type === 'fichier' && !p.cheminStockage && !p._demo && !p.archivedAt)
      .toArray()
    let envoye = false
    for (const p of aEnvoyer) {
      const fichier = await this.db.fichiers.get(p.id)
      if (!fichier) continue
      const chemin = `${p.id}/${nomFichierSur(p.nomFichier ?? 'document')}`
      await this.transport.envoyerFichier(chemin, fichier.blob)
      await this.marquerEnvoye(p, chemin)
      envoye = true
    }
    return envoye
  }

  private async marquerEnvoye(p: PieceJointe, chemin: string) {
    const tic = this.horloge.tic()
    await this.db.transaction('rw', [this.db.piecesJointes, this.db.outbox], async () => {
      await this.db.piecesJointes.update(p.id, { cheminStockage: chemin, _ts: { ...p._ts, cheminStockage: tic } })
      await this.db.outbox.add({ table: 'piecesJointes', rowId: p.id, champs: { cheminStockage: chemin }, ts: { cheminStockage: tic }, creeLe: new Date().toISOString() })
    })
  }

  /** Télécharge un fichier absent de cet appareil et le garde pour la consultation hors ligne. */
  async telechargerFichier(p: PieceJointe): Promise<Blob | undefined> {
    if (!p.cheminStockage) return undefined
    const blob = await this.transport.telechargerFichier(p.cheminStockage)
    await this.db.fichiers.put({ id: p.id, blob })
    return blob
  }
}

/** Nom de fichier sans accents ni caractères spéciaux (chemins du stockage). */
export function nomFichierSur(nom: string): string {
  return (
    nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120) || 'document'
  )
}
