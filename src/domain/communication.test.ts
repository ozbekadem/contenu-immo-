import { describe, expect, it } from 'vitest'
import { avecDesinscription, avertissementIndividuel, eligibleCampagne, MODELES_DEFAUT, rendre, salutation } from './communication'

const base = { nePasContacter: false, aTelephone: true, aEmail: true }
const accord = { etat: 'accorde' as const, date: '2026-09-01', preuve: 'Accord oral' }

describe('Modèles de messages', () => {
  it('personnalise le message et retire proprement ce qui manque', () => {
    expect(rendre('{{bonjour}}, ici {{agent}} ({{agence}}). À bientôt à {{ville}} !', { prenom: 'Marc', agent: 'Adem', agence: null, ville: 'Gosselies' })).toEqual({
      texte: 'Bonjour Marc, ici Adem. À bientôt à Gosselies !',
      manquantes: ['agence'],
    })
    expect(salutation({ civilite: 'Mme', nom: 'Claes' })).toBe('Bonjour Madame Claes')
    expect(salutation({})).toBe('Bonjour')
    expect(rendre('{{inconnue}} reste', {}).texte).toBe('{{inconnue}} reste')
  })

  it('chaque modèle fourni se lit correctement, même sans aucune information', () => {
    for (const m of MODELES_DEFAUT) {
      const r = rendre(m.texte, {})
      expect(rendre(m.sujet, {}).manquantes, m.nom).toEqual([])
      expect(r.manquantes.filter((v) => !['agent', 'agence'].includes(v)), m.nom).toEqual([]) // seule la signature peut manquer
      expect(r.texte, m.nom).not.toMatch(/\{\{|\(\s*\)| ,|\s\.|\n{3}|\n$/)
      expect(rendre(m.texte, { prenom: 'Marc', agent: 'Adem', agence: 'Agence du Centre' }).texte, m.nom).toMatch(/^Bonjour Marc/)
    }
  })
})

describe('RGPD des campagnes', () => {
  it('campagne : consentement accordé et valable obligatoire', () => {
    const aujourdhui = '2026-10-02'
    expect(eligibleCampagne({ ...base, consentements: { sms: accord } }, 'sms', aujourdhui)).toEqual({ ok: true })
    expect(eligibleCampagne(base, 'sms', aujourdhui)).toEqual({ ok: false, raison: 'sans_consentement' })
    expect(eligibleCampagne({ ...base, consentements: { sms: accord } }, 'email', aujourdhui)).toEqual({ ok: false, raison: 'sans_consentement' })
    expect(eligibleCampagne({ ...base, consentements: { sms: { ...accord, etat: 'retire' } } }, 'sms', aujourdhui)).toEqual({ ok: false, raison: 'retire' })
    expect(eligibleCampagne({ ...base, consentements: { sms: { ...accord, expire: '2026-01-01' } } }, 'sms', aujourdhui)).toEqual({ ok: false, raison: 'expire' })
    expect(eligibleCampagne({ ...base, nePasContacter: true, consentements: { sms: accord } }, 'sms', aujourdhui)).toEqual({ ok: false, raison: 'opposition' })
    expect(eligibleCampagne({ ...base, aEmail: false, consentements: { email: accord } }, 'email', aujourdhui)).toEqual({ ok: false, raison: 'sans_coordonnees' })
  })

  it('message individuel : averti, jamais bloqué', () => {
    expect(avertissementIndividuel(base, 'sms')).toBeNull()
    expect(avertissementIndividuel({ ...base, consentements: { whatsapp: { ...accord, etat: 'retire' } } }, 'whatsapp')).toMatch(/retiré/)
    expect(avertissementIndividuel({ ...base, nePasContacter: true }, 'email')).toMatch(/ne plus être contacté/)
  })

  it('ajoute la mention de désinscription si elle manque', () => {
    expect(avecDesinscription('Bonjour Marc, nouvelle estimation ?', 'sms')).toBe('Bonjour Marc, nouvelle estimation ?\nRépondez STOP pour ne plus recevoir nos messages.')
    expect(avecDesinscription('Bonjour. Répondez STOP pour arrêter.', 'sms')).toBe('Bonjour. Répondez STOP pour arrêter.')
  })
})
