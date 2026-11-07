import { describe, expect, it } from 'vitest'
import { distanceMetres } from './prospection'
import { dureeLisible, interpoler, lienGoogleTournee, MAX_ETAPES_GOOGLE, ordreOptimise, resumeTournee, trajet, trajetLisible, trajets } from './tournee'

// Charleroi : place Charles II, Marcinelle, Gosselies (ordres de grandeur réels)
const charleroi = { lat: 50.4108, lng: 4.4446 }
const voisin = { lat: 50.4135, lng: 4.4446 } // ~300 m au nord
const marcinelle = { lat: 50.3925, lng: 4.4352 }
const gosselies = { lat: 50.4697, lng: 4.4335 }

describe('trajet', () => {
  it('propose la marche pour une adresse proche et la voiture au-delà', () => {
    const t = trajet(charleroi, voisin)
    expect(t.mode).toBe('pied')
    expect(t.metres).toBeGreaterThan(distanceMetres(charleroi, voisin))
    expect(trajetLisible(t)).toMatch(/^≈ \d+ min à pied$/)
    expect(trajet(charleroi, gosselies).mode).toBe('voiture')
    expect(trajetLisible(trajet(charleroi, gosselies))).toMatch(/en voiture$/)
  })

  it('donne des durées plausibles', () => {
    const t = trajet(charleroi, gosselies) // ~6,6 km à vol d'oiseau
    expect(t.minutesVoiture).toBeGreaterThanOrEqual(15)
    expect(t.minutesVoiture).toBeLessThanOrEqual(30)
    expect(trajet(charleroi, charleroi).minutesPied).toBe(1)
  })

  it('affiche les heures', () => {
    expect(dureeLisible(45)).toBe('45 min')
    expect(dureeLisible(60)).toBe('1 h')
    expect(dureeLisible(75)).toBe('1 h 15')
  })
})

describe('tournée', () => {
  it('compte le trajet depuis la position actuelle', () => {
    expect(trajets([voisin, marcinelle])).toHaveLength(1)
    expect(trajets([voisin, marcinelle], charleroi)).toHaveLength(2)
    const r = resumeTournee([voisin, marcinelle], charleroi)
    expect(r.etapes).toBe(2)
    expect(r.metres).toBeCloseTo(trajets([voisin, marcinelle], charleroi).reduce((s, t) => s + t.metres, 0))
  })

  it("remet les adresses dans l'ordre le plus court", () => {
    const desordre = [gosselies, marcinelle, voisin]
    const ordre = ordreOptimise(desordre, charleroi)
    // Le plus court : descendre à Marcinelle, puis remonter vers Gosselies en repassant par le voisin
    expect(ordre).toEqual([marcinelle, voisin, gosselies])
    const total = (l: typeof desordre) => resumeTournee(l, charleroi).metres
    expect(total(ordre)).toBeLessThanOrEqual(total(desordre))
    expect(new Set(ordre)).toEqual(new Set(desordre))
  })

  it('garde toutes les étapes sans point de départ', () => {
    const l = [marcinelle, gosselies, voisin, charleroi]
    const o = ordreOptimise(l)
    expect(o).toHaveLength(4)
    expect(new Set(o)).toEqual(new Set(l))
    expect(ordreOptimise([voisin])).toEqual([voisin])
  })

  it('construit le lien Google Maps avec les étapes intermédiaires', () => {
    const lien = new URL(lienGoogleTournee([voisin, marcinelle, gosselies], charleroi)!)
    expect(lien.hostname).toBe('www.google.com')
    expect(lien.searchParams.get('origin')).toBe('50.410800,4.444600')
    expect(lien.searchParams.get('destination')).toBe('50.469700,4.433500')
    expect(lien.searchParams.get('waypoints')).toBe('50.413500,4.444600|50.392500,4.435200')
    expect(lienGoogleTournee([])).toBeNull()
    const beaucoup = Array.from({ length: 14 }, (_, i) => ({
      lat: 50.4 + i / 1000,
      lng: 4.44,
    }))
    const l2 = new URL(lienGoogleTournee(beaucoup)!)
    expect(l2.searchParams.get('waypoints')!.split('|')).toHaveLength(MAX_ETAPES_GOOGLE - 1)
  })

  it('interpole le tracé', () => {
    expect(interpoler(charleroi, gosselies, 0)).toEqual(charleroi)
    expect(interpoler(charleroi, gosselies, 1)).toEqual(gosselies)
    expect(interpoler(charleroi, gosselies, 2)).toEqual(gosselies)
    expect(interpoler(charleroi, gosselies, 0.5).lat).toBeCloseTo((charleroi.lat + gosselies.lat) / 2)
  })
})
