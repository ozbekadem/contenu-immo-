import { eligibleCampagne, MODELES_DEFAUT, type CanalMessage, type ContenuModele, type RaisonBlocage } from '@/domain/communication'
import { normaliserTexte } from '@/domain/recherche'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { Campagne, Contact, Envoi, FiltresCampagne, Modele } from '../types'
import { RepositoryBase } from './base'
import { InteractionRepository } from './interactions'

export const FILTRES_VIDES: FiltresCampagne = {
  statuts: [],
  sources: [],
  localites: [],
  sansContactDepuisMois: null,
}

/** Modèle tel qu'affiché : fourni (lecture seule, à dupliquer) ou créé par l'agence. */
export interface ModeleVue extends ContenuModele {
  id: string
  fourni: boolean
}

export class ModeleRepository extends RepositoryBase<Modele> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.modeles, 'modeles')
  }
  protected deriver(m: Modele): Modele {
    return m
  }
  async tous(canal?: CanalMessage): Promise<ModeleVue[]> {
    const perso = (await this.db.modeles.toArray())
      .filter((m) => !m.archivedAt)
      .map((m) => ({
        id: m.id,
        nom: m.nom,
        canal: m.canal,
        sujet: m.sujet,
        texte: m.texte,
        fourni: false,
      }))
    const fournis = MODELES_DEFAUT.map((m) => ({ ...m, fourni: true }))
    return [...perso.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), ...fournis].filter((m) => !canal || m.canal === canal)
  }
}

/** Destinataires choisis par les filtres (contacts actifs uniquement). */
export function selectionner(contacts: Contact[], f: FiltresCampagne, maintenant = new Date()): Contact[] {
  const localites = f.localites.map(normaliserTexte).filter(Boolean)
  const limite = f.sansContactDepuisMois ? new Date(maintenant.getFullYear(), maintenant.getMonth() - f.sansContactDepuisMois, maintenant.getDate()).toISOString() : null
  return contacts.filter(
    (c) =>
      !c.archivedAt &&
      (!f.statuts.length || c.statuts.some((s) => f.statuts.includes(s))) &&
      (!f.sources.length || (!!c.source && f.sources.includes(c.source))) &&
      (!localites.length || (!!c.adresse && localites.some((l) => normaliserTexte(`${c.adresse!.ville} ${c.adresse!.cp}`).includes(l)))) &&
      (!limite || !c.dernierContactAt || c.dernierContactAt < limite),
  )
}

export interface Repartition {
  aEnvoyer: Contact[]
  bloques: { contact: Contact; raison: RaisonBlocage }[]
}

/** Qui peut recevoir la campagne, et qui est bloqué (avec la raison) — la règle RGPD est appliquée ici. */
export function repartir(contacts: Contact[], canal: CanalMessage, aujourdhui: string): Repartition {
  const r: Repartition = { aEnvoyer: [], bloques: [] }
  for (const c of contacts) {
    const e = eligibleCampagne(
      {
        nePasContacter: c.nePasContacter,
        aTelephone: c._telNorm.length > 0,
        aEmail: c.emails.length > 0,
        consentements: c.consentements,
      },
      canal,
      aujourdhui,
    )
    if (e.ok) r.aEnvoyer.push(c)
    else r.bloques.push({ contact: c, raison: e.raison })
  }
  return r
}

export class EnvoiRepository extends RepositoryBase<Envoi> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.envois, 'envois')
  }
  protected deriver(e: Envoi): Envoi {
    return e
  }
  async deCampagne(campagneId: string): Promise<Envoi[]> {
    return this.db.envois.where('campagneId').equals(campagneId).toArray()
  }
}

export class CampagneRepository extends RepositoryBase<Campagne> {
  readonly envois: EnvoiRepository
  private readonly interactions: InteractionRepository
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.campagnes, 'campagnes')
    this.envois = new EnvoiRepository(db)
    this.interactions = new InteractionRepository(db)
  }
  protected deriver(c: Campagne): Campagne {
    return c
  }

  /** Crée la campagne et fige la liste des destinataires (y compris les bloqués, pour la traçabilité RGPD). */
  async lancer(donnees: Pick<Campagne, 'nom' | 'canal' | 'sujet' | 'texte' | 'filtres'>, repartition: Repartition): Promise<Campagne> {
    const tous = [...repartition.aEnvoyer, ...repartition.bloques.map((b) => b.contact)]
    // Campagne sur les contacts de démonstration : reste locale, effacée avec la démo.
    const demo = tous.length > 0 && tous.every((c) => c._demo)
    return this.db.transaction('rw', [this.db.campagnes, this.db.envois, this.db.journal, this.db.outbox], async () => {
      const campagne = await this.creer({ ...donnees, archivedAt: null }, { demo })
      await this.envois.creerPlusieurs(
        [
          ...repartition.aEnvoyer.map((c) => ({
            campagneId: campagne.id,
            contactId: c.id,
            etat: 'a_envoyer' as const,
            raison: null,
            envoyeAt: null,
          })),
          ...repartition.bloques.map(({ contact, raison }) => ({
            campagneId: campagne.id,
            contactId: contact.id,
            etat: 'bloque' as const,
            raison,
            envoyeAt: null,
          })),
        ],
        { journaliser: false, demo },
      )
      return campagne
    })
  }

  /** Message ouvert dans l'application du téléphone : noté « envoyé » et ajouté à l'historique du contact. */
  async marquerEnvoye(campagne: Campagne, envoi: Envoi, texte: string): Promise<void> {
    const maintenant = new Date().toISOString()
    await this.envois.modifier(envoi.id, {
      etat: 'envoye',
      envoyeAt: maintenant,
    })
    await this.interactions.creer(
      {
        contactId: envoi.contactId,
        pisteId: null,
        type: campagne.canal,
        resultat: 'message_envoye',
        commentaire: `Campagne « ${campagne.nom} » : ${texte}`,
        date: maintenant,
        relanceAt: null,
        numero: null,
        campagneId: campagne.id,
      },
      { demo: !!campagne._demo },
    )
  }

  async ignorer(envoi: Envoi): Promise<void> {
    await this.envois.modifier(envoi.id, { etat: 'ignore' })
  }
}

export const modeles = new ModeleRepository()
export const campagnes = new CampagneRepository()
