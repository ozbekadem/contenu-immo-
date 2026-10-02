import { ErreurGoogle, type EvenementGoogle, type TransportGoogle } from './transport'

/** Google Agenda simulé (tests) : calendriers, identifiants imposés, jetons de synchronisation. */
export class FauxGoogle {
  calendriers = new Map<string, string>()
  evenements = new Map<string, EvenementGoogle>()
  private horloge = Date.parse('2026-10-01T08:00:00Z')
  private journal: { seq: number; id: string }[] = []
  private seq = 0
  appels = 0
  /** Autres agendas (le principal, celui de la secrétaire…) : id → événements. */
  autres = new Map<string, { nom: string; principal: boolean; evenements: Map<string, EvenementGoogle> }>()

  ajouterAgenda(id: string, nom: string, principal = false): void {
    this.autres.set(id, { nom, principal, evenements: new Map() })
  }
  /** Événement créé (ou modifié) par quelqu'un dans un autre agenda. */
  ecrireDans(agenda: string, e: EvenementGoogle): void {
    this.autres.get(agenda)!.evenements.set(e.id, { status: 'confirmed', ...structuredClone(e) })
  }
  supprimerDans(agenda: string, id: string): void {
    this.autres.get(agenda)!.evenements.delete(id)
  }

  private maj(e: EvenementGoogle): EvenementGoogle {
    this.horloge += 1000
    const enregistre = { ...structuredClone(e), updated: new Date(this.horloge).toISOString() }
    this.evenements.set(e.id, enregistre)
    this.journal.push({ seq: ++this.seq, id: e.id })
    return structuredClone(enregistre)
  }

  /** Ce que fait l'utilisateur directement dans Google Agenda. */
  modifierDansGoogle(id: string, patch: Partial<EvenementGoogle>): void {
    this.maj({ ...this.evenements.get(id)!, ...patch })
  }
  creerDansGoogle(e: EvenementGoogle): void {
    this.maj({ status: 'confirmed', ...e })
  }

  actifs(): EvenementGoogle[] {
    return [...this.evenements.values()].filter((e) => e.status !== 'cancelled')
  }

  transport(): TransportGoogle {
    return {
      agendas: async () => {
        this.appels++
        return [
          ...[...this.autres].map(([id, a]) => ({ id, nom: a.nom, principal: a.principal })),
          ...[...this.calendriers].map(([nom, id]) => ({ id, nom, principal: false })),
        ]
      },
      lister: async (cal, du, au) => {
        this.appels++
        const a = this.autres.get(cal)
        if (!a) throw new ErreurGoogle(404, 'Not Found')
        return [...a.evenements.values()]
          .filter((e) => {
            const debut = new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00`).getTime()
            return e.status !== 'cancelled' && debut < au.getTime() && debut >= du.getTime() - 86_400_000
          })
          .map((e) => structuredClone(e))
      },
      calendrier: async (nom) => {
        this.appels++
        if (!this.calendriers.has(nom)) this.calendriers.set(nom, `cal-${nom}@group.calendar.google.com`)
        return this.calendriers.get(nom)!
      },
      changements: async (_cal, syncToken) => {
        this.appels++
        const depuis = syncToken ? Number(syncToken) : 0
        const ids = new Set(this.journal.filter((j) => j.seq > depuis).map((j) => j.id))
        return { evenements: [...ids].map((id) => structuredClone(this.evenements.get(id)!)), syncToken: String(this.seq) }
      },
      inserer: async (_cal, e) => {
        this.appels++
        if (!/^[a-v0-9]{5,1024}$/.test(e.id)) throw new ErreurGoogle(400, 'Identifiant invalide')
        if (this.evenements.has(e.id)) throw new ErreurGoogle(409, 'The requested identifier already exists.')
        return this.maj({ ...e, status: 'confirmed' })
      },
      remplacer: async (_cal, e) => {
        this.appels++
        if (!this.evenements.has(e.id)) throw new ErreurGoogle(404, 'Not Found')
        return this.maj({ ...e, status: 'confirmed' })
      },
      supprimer: async (_cal, id) => {
        this.appels++
        const e = this.evenements.get(id)
        if (!e || e.status === 'cancelled') throw new ErreurGoogle(410, 'Resource has been deleted')
        this.maj({ ...e, status: 'cancelled' })
      },
    }
  }
}
