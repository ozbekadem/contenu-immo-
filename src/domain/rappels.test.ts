import { describe, expect, it } from 'vitest'
import type { Bien, Contact, Evenement, Piste } from '@/data/types'
import { PREFERENCES_DEFAUT, rappelsDus } from './rappels'

const maintenant = new Date('2026-10-05T08:00:00Z') // lundi 10 h à Bruxelles
const base = { archivedAt: null, createdBy: 'moi', collaborateurId: null }
const contact = (id: string, x: Partial<Contact>) => ({ ...base, id, prenom: '', nom: id, societe: '', telephones: [], nePasContacter: false, prochaineRelanceAt: null, ...x }) as unknown as Contact
const options = { maintenant, fenetreMs: 10 * 60_000, utilisateur: 'moi' }

describe('Rappels affichés par l’application', () => {
  it('mêmes règles que le serveur : à l’heure, à moi, sans doublon contact/piste', () => {
    const contacts = [
      contact('Dupont', { prenom: 'Marc', telephones: [{ numero: '0472 18 90 33' }], prochaineRelanceAt: '2026-10-05T07:55:00.000Z' }),
      contact('Futur', { prochaineRelanceAt: '2026-10-05T08:30:00.000Z' }),
      contact('Collègue', { collaborateurId: 'autre', prochaineRelanceAt: '2026-10-05T07:58:00.000Z' }),
      contact('Rossi', { prochaineRelanceAt: '2026-10-05T07:55:00.000Z' }),
    ]
    const pistes = [{ ...base, id: 'p1', categorie: 'maison_vide', statut: 'en_cours', bienId: 'b1', contactId: 'Rossi', prochaineRelanceAt: '2026-10-05T07:56:00.000Z', alerte: null }] as unknown as Piste[]
    const biens = [{ id: 'b1', adresse: { rue: 'Rue Puissant', numero: '7', boite: '', cp: '6060', ville: 'Gilly' } }] as unknown as Bien[]
    const evenements = [{ ...base, id: 'e1', titre: 'Estimation Dupont', lieu: 'Chez M. Dupont', debut: '2026-10-05T08:25:00.000Z', journee: false }] as unknown as Evenement[]
    const r = rappelsDus({ contacts, pistes, biens, evenements }, PREFERENCES_DEFAUT, options)
    expect(r.map((x) => x.titre)).toEqual(['📞 Relancer Marc Dupont', '📞 Maison vide – Rue Puissant 7, Gilly', '📅 Estimation Dupont à 10h25'])
    expect(r[0]).toMatchObject({ cle: 'relance:contacts:Dupont:2026-10-05T07:55:00.000Z', corps: 'Téléphone : 0472 18 90 33', url: '/contacts/Dupont' })
    expect(r[1]!.corps).toBe('Appeler Rossi')
    expect(rappelsDus({ contacts, pistes, biens, evenements }, { ...PREFERENCES_DEFAUT, relances: false }, options)).toHaveLength(1)
  })
})
