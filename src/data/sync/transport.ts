/** Fiche telle que stockée sur le serveur. */
export interface LigneServeur {
  entite: string
  id: string
  donnees: Record<string, unknown>
  ts: Record<string, string>
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
  server_seq: number
}

export interface JournalServeur {
  id: string
  entite: string
  row_id: string
  champ: string
  avant: unknown
  apres: unknown
  auteur: string | null
  appareil: string | null
  at: string
  conflit: boolean
  server_seq: number
}

export interface OperationEnvoi {
  entite: string
  id: string
  champs: Record<string, unknown>
  ts: Record<string, string>
}

export interface Rejet {
  entite: string
  id: string
  champ: string
}

/**
 * Tout ce dont le moteur de synchronisation a besoin du serveur.
 * Implémenté pour Supabase, et par un faux serveur en mémoire dans les tests.
 */
export interface Transport {
  push(ops: OperationEnvoi[], appareil: string): Promise<{ rejets: Rejet[] }>
  pull(depuis: number, limite: number): Promise<LigneServeur[]>
  pushJournal(entrees: Omit<JournalServeur, 'server_seq'>[]): Promise<void>
  pullJournal(depuis: number, limite: number): Promise<JournalServeur[]>
  envoyerFichier(chemin: string, contenu: Blob): Promise<void>
  telechargerFichier(chemin: string): Promise<Blob>
  /** Déclare l'appareil et indique s'il a été déconnecté à distance. */
  signalerAppareil(id: string, nom: string): Promise<{ revoque: boolean }>
  /** Prévient quand une autre personne modifie des données. Retourne la fonction d'arrêt. */
  ecouter(surChangement: () => void): () => void
}
