import { describe, expect, it } from 'vitest'
import { contactVide } from '@/data/repositories/contacts'
import type { Contact } from '@/data/types'
import { ajouterJours } from '@/domain/dates'
import { couleurContact } from './affichage'
import { appliquerFiltre, rechercher, trier, type ContactColore } from './filtres'

const maintenant = new Date(2026, 8, 30, 10)
const iso = (n: number) => ajouterJours(maintenant, n).toISOString()

function contact(nom: string, patch: Partial<Contact> = {}): ContactColore {
  const c = {
    ...contactVide(),
    id: nom,
    nom,
    createdAt: iso(-1),
    updatedAt: iso(-1),
    createdBy: null,
    updatedBy: null,
    archivedAt: null,
    _ts: {},
    _telNorm: [],
    _tri: nom,
    _recherche: nom.toLowerCase(),
    ...patch,
  } as Contact
  return { contact: c, couleur: couleurContact(c, maintenant) }
}

const liste = [
  contact('Retard', { prochaineRelanceAt: iso(-2) }),
  contact('Jour', { prochaineRelanceAt: iso(0) }),
  contact('Semaine', { prochaineRelanceAt: iso(5) }),
  contact('Chaud', { temperature: 'chaud', prochaineRelanceAt: iso(30), dernierContactAt: iso(-3) }),
  contact('Oublie', { dernierContactAt: iso(-200), prochaineRelanceAt: iso(40) }),
  contact('Archive', { archivedAt: iso(-1) }),
]

const noms = (l: ContactColore[]) => l.map((x) => x.contact.nom)

describe('filtres rapides', () => {
  it('« Tous » masque les archivés', () => {
    expect(noms(appliquerFiltre(liste, 'tous', maintenant))).not.toContain('Archive')
  })
  it('En retard / Aujourd’hui / Cette semaine', () => {
    expect(noms(appliquerFiltre(liste, 'retard', maintenant))).toEqual(['Retard'])
    expect(noms(appliquerFiltre(liste, 'aujourdhui', maintenant))).toEqual(['Jour'])
    expect(noms(appliquerFiltre(liste, 'semaine', maintenant))).toEqual(['Jour', 'Semaine'])
  })
  it('Positifs et Sans contact depuis 6 mois', () => {
    expect(noms(appliquerFiltre(liste, 'positifs', maintenant))).toEqual(['Chaud'])
    expect(noms(appliquerFiltre(liste, 'sans6mois', maintenant))).toContain('Oublie')
    expect(noms(appliquerFiltre(liste, 'sans6mois', maintenant))).not.toContain('Chaud')
  })
  it('Archivés', () => {
    expect(noms(appliquerFiltre(liste, 'archives', maintenant))).toEqual(['Archive'])
  })
  it('recherche combinée au filtre', () => {
    expect(noms(rechercher(liste, 'sem'))).toEqual(['Semaine'])
  })
})

describe('tri', () => {
  it('par prochaine relance, sans relance en dernier', () => {
    expect(noms(trier(liste, 'relance')).slice(0, 3)).toEqual(['Retard', 'Jour', 'Semaine'])
    expect(noms(trier(liste, 'relance')).at(-1)).toBe('Archive')
  })
  it('par dernier contact : jamais contacté d’abord, puis le plus ancien', () => {
    const t = noms(trier(liste, 'dernier'))
    expect(t.indexOf('Oublie')).toBeLessThan(t.indexOf('Chaud'))
    expect(t.at(-1)).toBe('Chaud')
  })
})
