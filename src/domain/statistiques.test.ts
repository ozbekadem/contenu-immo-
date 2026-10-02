import { describe, expect, it } from 'vitest'
import type { Contact, Interaction, Piste } from '@/data/types'
import { chiffres, parOrigine, parSemaine, periode, valeurPortefeuille } from './statistiques'

const maintenant = new Date(2026, 9, 2, 15) // vendredi 2 octobre 2026
const ix = (x: Partial<Interaction>): Interaction => ({ id: crypto.randomUUID(), archivedAt: null, createdBy: 'adem', contactId: 'c1', pisteId: null, type: 'appel', resultat: 'pas_reponse', date: maintenant.toISOString(), ...x }) as Interaction
const piste = (x: Partial<Piste>): Piste => ({ id: crypto.randomUUID(), archivedAt: null, createdBy: 'adem', createdAt: maintenant.toISOString(), statut: 'a_contacter', source: 'affiche', contactId: null, prix: null, ...x }) as Piste

describe('Statistiques', () => {
  it('périodes : semaine du lundi, mois, et la période précédente de même durée', () => {
    const s = periode('semaine', maintenant)
    expect(s.du).toEqual(new Date(2026, 8, 28))
    expect(s.precedente.du).toEqual(new Date(2026, 8, 21))
    expect(periode('mois', maintenant).du).toEqual(new Date(2026, 9, 1))
    expect(periode('trimestre', maintenant).du).toEqual(new Date(2026, 9, 1))
    expect(periode('annee', maintenant).precedente.du).toEqual(new Date(2025, 0, 1))
  })

  it('chiffres d’activité, au total et par personne', () => {
    const interactions = [
      ix({ resultat: 'interesse' }),
      ix({ resultat: 'pas_reponse' }),
      ix({ resultat: 'rdv', createdBy: 'sara' }),
      ix({ type: 'sms', resultat: 'message_envoye' }),
      ix({ type: 'rdv', resultat: 'mandat' }),
      ix({ resultat: 'interesse', date: new Date(2026, 8, 20).toISOString() }), // semaine passée
    ]
    const p = periode('semaine', maintenant)
    expect(chiffres(interactions, [piste({})], p)).toEqual({ appels: 3, joints: 2, rdv: 1, signatures: 1, messages: 1, reperages: 1 })
    expect(chiffres(interactions, [], p, 'sara')).toMatchObject({ appels: 1, rdv: 1 })
    const semaines = parSemaine(interactions, maintenant, 3)
    expect(semaines.map((s) => s.appels)).toEqual([1, 0, 3])
  })

  it('résultats par origine et valeur du portefeuille', () => {
    const p1 = piste({ source: 'affiche', statut: 'gagne' })
    const p2 = piste({ source: 'affiche', statut: 'rdv', prix: 200000 })
    const p3 = piste({ source: 'immoweb', statut: 'en_cours', prix: 150000 })
    const contacts = [{ id: 'k', archivedAt: null, source: 'recommandation' } as Contact]
    const lignes = parOrigine(contacts, [p1, p2, p3], [ix({ contactId: 'k', resultat: 'mandat', type: 'rdv' })])
    expect(lignes.find((l) => l.source === 'affiche')).toMatchObject({ fiches: 2, rdv: 2, signes: 1, tauxRdv: 100 })
    expect(lignes.find((l) => l.source === 'recommandation')).toMatchObject({ fiches: 1, signes: 1 })
    expect(valeurPortefeuille([p1, p2, p3], 3)).toEqual({ pistes: 1, prixTotal: 200000, commission: 6000 })
  })
})
