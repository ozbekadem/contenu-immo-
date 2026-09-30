import { normaliserTelephone } from '@/domain/telephone'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import { deriverContact } from '../derives'
import type { Adresse, Contact } from '../types'
import { RepositoryBase, type Donnees } from './base'

export type DonneesContact = Donnees<Contact>

export function contactVide(): DonneesContact {
  return {
    civilite: '',
    prenom: '',
    nom: '',
    societe: '',
    telephones: [],
    emails: [],
    adresse: null,
    anciennesAdresses: [],
    dateNaissance: null,
    statuts: [],
    source: null,
    temperature: null,
    canalPrefere: null,
    utilisationCanaux: {},
    collaborateurId: null,
    tags: [],
    notes: '',
    nePasContacter: false,
    dernierContactAt: null,
    prochaineRelanceAt: null,
    dernierResultatPositif: false,
  }
}

export function adresseVide(): Adresse {
  return { rue: '', numero: '', boite: '', cp: '', ville: '' }
}

export function adresseEstVide(a: Adresse | null | undefined): boolean {
  return !a || Object.values(a).every((v) => !v.trim())
}

export class ContactRepository extends RepositoryBase<Contact> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.contacts, 'contacts')
  }

  protected deriver(c: Contact): Contact {
    return deriverContact(c)
  }

  /**
   * Modifie un contact. Quand l'adresse change, l'ancienne est automatiquement
   * archivée dans l'historique (jamais effacée).
   */
  override async modifier(id: string, patch: Partial<DonneesContact>): Promise<Contact> {
    return this.db.transaction('rw', [this.db.contacts, this.db.journal, this.db.outbox], async () => {
      if ('adresse' in patch) {
        const actuel = await this.db.contacts.get(id)
        const ancienne = actuel?.adresse
        const nouvelle = adresseEstVide(patch.adresse) ? null : patch.adresse
        patch = { ...patch, adresse: nouvelle ?? null }
        if (actuel && ancienne && !adresseEstVide(ancienne) && JSON.stringify(ancienne) !== JSON.stringify(nouvelle)) {
          patch.anciennesAdresses = [
            { ...ancienne, jusquau: new Date().toISOString().slice(0, 10) },
            ...(patch.anciennesAdresses ?? actuel.anciennesAdresses),
          ]
        }
      }
      return super.modifier(id, patch)
    })
  }

  /** Contacts (archivés compris) ayant au moins un de ces numéros. */
  async trouverParTelephones(numeros: string[], exclureId?: string): Promise<Contact[]> {
    const norm = [...new Set(numeros.map(normaliserTelephone).filter((n): n is string => !!n))]
    if (norm.length === 0) return []
    const trouves = await this.db.contacts.where('_telNorm').anyOf(norm).distinct().toArray()
    return trouves.filter((c) => c.id !== exclureId)
  }

  /** Tous les contacts triés par nom (5 000 fiches ≈ quelques dizaines de ms). */
  tous(): Promise<Contact[]> {
    return this.db.contacts.orderBy('_tri').toArray()
  }

  compter(): Promise<number> {
    return this.db.contacts.count()
  }
}

export const contacts = new ContactRepository()
