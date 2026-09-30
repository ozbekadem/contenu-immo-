import type { JournalServeur, LigneServeur, OperationEnvoi, Rejet, Transport } from './transport'

/**
 * Faux serveur en mémoire, reproduisant exactement la fusion de sync_push (SQL),
 * pour tester la synchronisation entre plusieurs appareils sans réseau.
 */
export class FauxServeur {
  seq = 0
  lignes = new Map<string, LigneServeur>()
  journal: JournalServeur[] = []
  fichiers = new Map<string, Blob>()
  appareilsRevoques = new Set<string>()
  private ecouteurs = new Set<() => void>()
  horsLigne = false

  private prochain() {
    return ++this.seq
  }

  private verifier() {
    if (this.horsLigne) throw new Error('Failed to fetch')
  }

  push(ops: OperationEnvoi[], appareil: string, auteur: string | null): { rejets: Rejet[] } {
    this.verifier()
    const rejets: Rejet[] = []
    for (const op of ops) {
      const cle = `${op.entite}/${op.id}`
      const actuelle = this.lignes.get(cle)
      const maintenant = new Date().toISOString()
      if (!actuelle) {
        this.lignes.set(cle, {
          entite: op.entite,
          id: op.id,
          donnees: { ...op.champs },
          ts: { ...op.ts },
          created_at: maintenant,
          created_by: auteur,
          updated_at: maintenant,
          updated_by: auteur,
          server_seq: this.prochain(),
        })
        continue
      }
      let modifie = false
      for (const [champ, valeur] of Object.entries(op.champs)) {
        const tsEntrant = op.ts[champ]!
        const tsActuel = actuelle.ts[champ]
        if (!tsActuel || tsEntrant > tsActuel) {
          actuelle.donnees[champ] = valeur
          actuelle.ts[champ] = tsEntrant
          modifie = true
        } else if (tsEntrant < tsActuel) {
          this.journal.push({
            id: crypto.randomUUID(),
            entite: op.entite,
            row_id: op.id,
            champ,
            avant: valeur,
            apres: actuelle.donnees[champ],
            auteur,
            appareil,
            at: maintenant,
            conflit: true,
            server_seq: this.prochain(),
          })
          rejets.push({ entite: op.entite, id: op.id, champ })
        }
      }
      if (modifie) {
        actuelle.updated_at = maintenant
        actuelle.updated_by = auteur
        actuelle.server_seq = this.prochain()
      }
    }
    this.notifier()
    return { rejets }
  }

  private notifier() {
    for (const f of this.ecouteurs) f()
  }

  /** Transport d'un appareil connecté avec l'utilisateur donné. */
  transport(auteur: string | null = null): Transport {
    return {
      push: async (ops, appareil) => this.push(structuredClone(ops), appareil, auteur),
      pull: async (depuis, limite) => {
        this.verifier()
        return structuredClone(
          [...this.lignes.values()].filter((l) => l.server_seq > depuis).sort((a, b) => a.server_seq - b.server_seq).slice(0, limite),
        )
      },
      pushJournal: async (entrees) => {
        this.verifier()
        for (const e of entrees) if (!this.journal.some((j) => j.id === e.id)) this.journal.push({ ...structuredClone(e), server_seq: this.prochain() })
      },
      pullJournal: async (depuis, limite) => {
        this.verifier()
        return structuredClone(this.journal.filter((j) => j.server_seq > depuis).sort((a, b) => a.server_seq - b.server_seq).slice(0, limite))
      },
      envoyerFichier: async (chemin, contenu) => {
        this.verifier()
        this.fichiers.set(chemin, contenu)
      },
      telechargerFichier: async (chemin) => {
        this.verifier()
        const f = this.fichiers.get(chemin)
        if (!f) throw new Error('Fichier introuvable')
        return f
      },
      signalerAppareil: async (id) => {
        this.verifier()
        return { revoque: this.appareilsRevoques.has(id) }
      },
      ecouter: (f) => {
        this.ecouteurs.add(f)
        return () => this.ecouteurs.delete(f)
      },
    }
  }
}
