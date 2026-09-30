import { describe, expect, it } from 'vitest'
import {
  estMobile,
  formaterTelephone,
  lienAppel,
  lienEmail,
  lienSms,
  lienWhatsapp,
  normaliserTelephone,
  ordreCanaux,
} from './telephone'

describe('normaliserTelephone', () => {
  it.each([
    ['0476 12 34 56', '+32476123456'],
    ['0476/12.34.56', '+32476123456'],
    ['0032 476 12 34 56', '+32476123456'],
    ['+32 (0)476 12 34 56', '+32476123456'],
    ['+32476123456', '+32476123456'],
    ['071 12 34 56', '+3271123456'], // fixe Charleroi
    ['+33 6 12 34 56 78', '+33612345678'], // numéro français conservé
  ])('%s → %s', (saisie, attendu) => {
    expect(normaliserTelephone(saisie)).toBe(attendu)
  })

  it('refuse les numéros invalides', () => {
    expect(normaliserTelephone('')).toBeNull()
    expect(normaliserTelephone('123')).toBeNull()
    expect(normaliserTelephone('abc')).toBeNull()
    expect(normaliserTelephone(null)).toBeNull()
  })
})

describe('formaterTelephone', () => {
  it('affiche au format international', () => {
    expect(formaterTelephone('0476123456')).toBe('+32 476 12 34 56')
  })
  it('garde la saisie si invalide', () => {
    expect(formaterTelephone(' 12 ')).toBe('12')
  })
})

describe('estMobile', () => {
  it('reconnaît les GSM belges', () => {
    expect(estMobile('0476 12 34 56')).toBe(true)
    expect(estMobile('071 12 34 56')).toBe(false)
  })
})

describe('liens', () => {
  it('WhatsApp ouvre la conversation avec le bon numéro, sans « + »', () => {
    expect(lienWhatsapp('+32476123456')).toBe('https://wa.me/32476123456')
    expect(lienWhatsapp('+32476123456', 'Bonjour Marie')).toBe('https://wa.me/32476123456?text=Bonjour%20Marie')
  })
  it('appel, SMS et email', () => {
    expect(lienAppel('+32476123456')).toBe('tel:+32476123456')
    expect(lienSms('+32476123456')).toBe('sms:+32476123456')
    expect(lienEmail('a@b.be', 'Votre bien', 'Bonjour')).toBe('mailto:a@b.be?subject=Votre%20bien&body=Bonjour')
  })
})

describe('ordreCanaux', () => {
  it('ordre par défaut sans historique, sans email si absent', () => {
    expect(ordreCanaux()).toEqual(['appel', 'whatsapp', 'sms'])
    expect(ordreCanaux({}, true)).toEqual(['appel', 'whatsapp', 'sms', 'email'])
  })
  it('le canal le plus utilisé pour ce contact passe en premier', () => {
    expect(ordreCanaux({ whatsapp: 5, appel: 2 })).toEqual(['whatsapp', 'appel', 'sms'])
    expect(ordreCanaux({ email: 3 }, true)[0]).toBe('email')
  })
})
