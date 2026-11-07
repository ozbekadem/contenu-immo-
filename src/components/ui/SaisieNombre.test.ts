import { describe, expect, it } from 'vitest'
import { lireNombre } from './SaisieNombre'

describe('lireNombre', () => {
  it('lit les écritures belges', () => {
    expect(lireNombre('150 000')).toBe(150000)
    expect(lireNombre('150.000')).toBe(150000)
    expect(lireNombre('150 000 €')).toBe(150000)
    expect(lireNombre('12,5')).toBe(12.5)
    expect(lireNombre('12.5 %')).toBe(12.5)
    expect(lireNombre('150k')).toBe(150000)
    expect(lireNombre('')).toBeNull()
    expect(lireNombre('abc')).toBeNull()
  })
})
