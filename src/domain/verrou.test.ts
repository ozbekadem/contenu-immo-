import { describe, expect, it } from 'vitest'
import { apresEchec, codeTropSimple, codeValide, depuisBase64Url, doitReverrouiller, nouvelleConfig, verifierCode, versBase64Url } from './verrou'

describe('verrouillage', () => {
  it('accepte 4 à 6 chiffres', () => {
    expect(codeValide('1234')).toBe(true)
    expect(codeValide('482915')).toBe(true)
    expect(codeValide('123')).toBe(false)
    expect(codeValide('12a4')).toBe(false)
    expect(codeValide('1234567')).toBe(false)
  })

  it('repère les codes trop simples', () => {
    expect(codeTropSimple('0000')).toBe(true)
    expect(codeTropSimple('1234')).toBe(true)
    expect(codeTropSimple('654321')).toBe(true)
    expect(codeTropSimple('4829')).toBe(false)
  })

  it('ne garde que l’empreinte du code et la vérifie', async () => {
    const c = await nouvelleConfig('4829', 1)
    expect(JSON.stringify(c)).not.toContain('4829')
    expect(await verifierCode(c, '4829')).toBe(true)
    expect(await verifierCode(c, '4828')).toBe(false)
    const autre = await nouvelleConfig('4829', 1)
    expect(autre.empreinte).not.toBe(c.empreinte) // sel différent
  })

  it('bloque après 5 erreurs, de plus en plus longtemps', () => {
    let t = { echecs: 0, bloqueJusque: 0 }
    for (let i = 0; i < 4; i++) t = apresEchec(t, 1000)
    expect(t.bloqueJusque).toBe(0)
    t = apresEchec(t, 1000)
    expect(t.bloqueJusque).toBe(31_000)
    t = apresEchec(t, 1000)
    expect(t.bloqueJusque).toBe(61_000)
    for (let i = 0; i < 10; i++) t = apresEchec(t, 1000)
    expect(t.bloqueJusque).toBe(1000 + 15 * 60_000)
  })

  it('reverrouille selon le délai choisi', () => {
    expect(doitReverrouiller(null, 10_000, 0)).toBe(false)
    expect(doitReverrouiller(10_000, 10_001, 0)).toBe(true)
    expect(doitReverrouiller(0, 59_000, 1)).toBe(false)
    expect(doitReverrouiller(0, 60_000, 1)).toBe(true)
  })

  it('convertit en base64url et retour', () => {
    const o = new Uint8Array([0, 250, 251, 255, 62, 63])
    expect([...depuisBase64Url(versBase64Url(o))]).toEqual([...o])
  })
})
