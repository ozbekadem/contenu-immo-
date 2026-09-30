import { describe, expect, it } from 'vitest'
import { champsModifies } from './diff'

describe('champsModifies', () => {
  it('ne retient que les champs changés, y compris dans les listes et objets', () => {
    const avant = { nom: 'Dupont', tags: ['a'], adresse: { ville: 'Jumet' }, notes: '' }
    const apres = { nom: 'Dupont', tags: ['a', 'b'], adresse: { ville: 'Jumet' }, notes: 'Rappeler' }
    expect(champsModifies(avant, apres)).toEqual({ tags: ['a', 'b'], notes: 'Rappeler' })
  })
  it('rien de changé → rien à envoyer', () => {
    expect(champsModifies({ a: 1, b: null }, { a: 1, b: undefined })).toEqual({})
  })
})
