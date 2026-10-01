import { describe, expect, it } from 'vitest'
import type { Bien, Contact, Piste } from '@/data/types'
import { construireVues, etatBien } from './useBiens'

const base = { createdBy: null, updatedBy: null, archivedAt: null, _ts: {} }
const bien = (id: string, maj: string, extra: Partial<Bien> = {}): Bien =>
  ({ ...base, id, createdAt: maj, updatedAt: maj, adresse: { rue: 'Rue du Moulin', numero: id, boite: '', cp: '6061', ville: 'Montignies' }, lat: null, lng: null, precisionGps: null, adresseAChercher: false, type: null, facades: null, chambres: null, notes: '', _cleAdresse: null, ...extra }) as Bien
const piste = (id: string, bienId: string, extra: Partial<Piste>): Piste =>
  ({ ...base, id, bienId, createdAt: '2026-09-01', updatedAt: '2026-09-01', categorie: 'annonce', statut: 'en_cours', contactId: null, ...extra }) as Piste
const contact = (id: string, nom: string) => ({ ...base, id, nom, prenom: '', archivedAt: null }) as unknown as Contact

describe('Fiches des biens', () => {
  it('état du bien, propriétaires et photos, du plus récent au plus ancien', () => {
    const vues = construireVues(
      [bien('1', '2026-09-01'), bien('2', '2026-09-20'), bien('3', '2026-09-10'), bien('4', '2026-09-15', { archivedAt: '2026-09-16' })],
      [
        piste('a', '1', { statut: 'gagne', contactId: 'c1' }),
        piste('b', '2', { categorie: 'maison_vide', statut: 'a_contacter', contactId: 'c2' }),
        piste('c', '2', { statut: 'perdu', contactId: 'c2', createdAt: '2026-08-01' }),
        piste('d', '3', { statut: 'perdu' }),
      ],
      [contact('c1', 'Lambert'), contact('c2', 'Rossi')],
      new Map([['2', 3]]),
    )
    expect(vues.map((v) => v.bien.id)).toEqual(['2', '3', '1']) // le bien archivé n'apparaît pas
    expect(vues.map(etatBien)).toEqual(['maison_vide', 'aucune', 'signe'])
    expect(vues[0]!.proprietaires.map((c) => c.nom)).toEqual(['Rossi']) // une seule fois
    expect(vues[0]!.nbPhotos).toBe(3)
    expect(vues[0]!.titre).toBe('Rue du Moulin 2, Montignies')
  })
})
