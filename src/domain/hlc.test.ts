import { describe, expect, it } from 'vitest'
import { Horloge, lireHlc } from './hlc'

describe('Horloge HLC', () => {
  it('produit des horodatages strictement croissants, même à la même milliseconde', () => {
    const h = new Horloge('a', () => 1000)
    const t1 = h.tic()
    const t2 = h.tic()
    expect(t2 > t1).toBe(true)
  })

  it("reste croissante si l'horloge de l'appareil recule", () => {
    let t = 5000
    const h = new Horloge('a', () => t)
    const avant = h.tic()
    t = 1000
    expect(h.tic() > avant).toBe(true)
  })

  it("dépasse un horodatage reçu d'un appareil en avance", () => {
    const retard = new Horloge('a', () => 1000)
    const avance = new Horloge('b', () => 9000)
    const distant = avance.tic()
    retard.recevoir(distant)
    const local = retard.tic()
    expect(local > distant).toBe(true)
    expect(lireHlc(local).appareil).toBe('a')
  })
})
