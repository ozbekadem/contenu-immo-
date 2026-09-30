import { Horloge } from '@/domain/hlc'

const CLE = 'linkimmo.appareil'

/** Identifiant court et stable de cet appareil (pour le journal et l'horloge de synchronisation). */
function identifiantAppareil(): string {
  try {
    let id = localStorage.getItem(CLE)
    if (!id) {
      id = crypto.randomUUID().slice(0, 8)
      localStorage.setItem(CLE, id)
    }
    return id
  } catch {
    return crypto.randomUUID().slice(0, 8)
  }
}

export const appareil = identifiantAppareil()
export const horloge = new Horloge(appareil)

/** Utilisateur connecté (branché sur l'authentification à l'étape 3). */
export let utilisateurCourant: string | null = null
export function definirUtilisateur(id: string | null) {
  utilisateurCourant = id
}
