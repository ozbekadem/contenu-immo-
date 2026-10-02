/** Événement tel que Google Agenda le représente (champs utilisés par Prospect’Immo). */
export interface EvenementGoogle {
  id: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  /** RFC 3339 : date de dernière modification côté Google. */
  updated?: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  reminders?: { useDefault: boolean; overrides?: { method: 'popup' | 'email'; minutes: number }[] }
  extendedProperties?: { private?: Record<string, string> }
}

export interface AgendaGoogle {
  id: string
  nom: string
  principal: boolean
}

export interface PageChangements {
  evenements: EvenementGoogle[]
  /** Jeton à réutiliser pour ne recevoir ensuite que les changements. */
  syncToken: string
}

/** Erreur de l'API Google, avec son code HTTP (401 : reconnexion nécessaire, 404, 409, 410…). */
export class ErreurGoogle extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message)
  }
}

/** Accès à Google Agenda (vrai service ou simulation pour les tests). */
export interface TransportGoogle {
  /** Identifiant du calendrier « Prospect’Immo » de l'utilisateur (créé s'il n'existe pas). */
  calendrier(nom: string): Promise<string>
  /** Tous les événements (syncToken null) ou seulement les changements depuis le jeton. 410 si le jeton a expiré. */
  changements(calendrierId: string, syncToken: string | null): Promise<PageChangements>
  /** Agendas visibles par l'utilisateur (le sien, ceux partagés avec lui). */
  agendas(): Promise<AgendaGoogle[]>
  /** Événements (non supprimés) d'un agenda entre deux dates, récurrences développées. */
  lister(calendrierId: string, du: Date, au: Date): Promise<EvenementGoogle[]>
  inserer(calendrierId: string, e: EvenementGoogle): Promise<EvenementGoogle>
  remplacer(calendrierId: string, e: EvenementGoogle): Promise<EvenementGoogle>
  supprimer(calendrierId: string, id: string): Promise<void>
}

const API = 'https://www.googleapis.com/calendar/v3'

/** Transport réel : appels directs à l'API Google Agenda avec le jeton d'accès de l'utilisateur. */
export function transportGoogle(jeton: () => string | null): TransportGoogle {
  const appel = async <T>(chemin: string, init: RequestInit = {}): Promise<T> => {
    const j = jeton()
    if (!j) throw new ErreurGoogle(401, 'Connexion Google nécessaire')
    const r = await fetch(`${API}${chemin}`, {
      ...init,
      headers: { Authorization: `Bearer ${j}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    if (!r.ok) {
      let message = `Google Agenda : erreur ${r.status}`
      try {
        message = ((await r.json()) as { error?: { message?: string } }).error?.message ?? message
      } catch {
        /* réponse sans détail */
      }
      throw new ErreurGoogle(r.status, message)
    }
    return (r.status === 204 ? undefined : await r.json()) as T
  }
  const cal = (id: string) => encodeURIComponent(id)

  return {
    async calendrier(nom) {
      let page: string | undefined
      do {
        const r = await appel<{ items?: { id: string; summary: string; accessRole: string }[]; nextPageToken?: string }>(
          `/users/me/calendarList?minAccessRole=owner${page ? `&pageToken=${page}` : ''}`,
        )
        const trouve = r.items?.find((c) => c.summary === nom)
        if (trouve) return trouve.id
        page = r.nextPageToken
      } while (page)
      const cree = await appel<{ id: string }>('/calendars', { method: 'POST', body: JSON.stringify({ summary: nom, timeZone: 'Europe/Brussels', description: 'Relances et rendez-vous Prospect’Immo' }) })
      return cree.id
    },
    async changements(calendrierId, syncToken) {
      const evenements: EvenementGoogle[] = []
      let page: string | undefined
      for (;;) {
        const p = new URLSearchParams({ showDeleted: 'true', maxResults: '250', singleEvents: 'true' })
        if (syncToken) p.set('syncToken', syncToken)
        if (page) p.set('pageToken', page)
        const r = await appel<{ items?: EvenementGoogle[]; nextPageToken?: string; nextSyncToken?: string }>(`/calendars/${cal(calendrierId)}/events?${p}`)
        evenements.push(...(r.items ?? []))
        if (r.nextPageToken) page = r.nextPageToken
        else return { evenements, syncToken: r.nextSyncToken ?? '' }
      }
    },
    async agendas() {
      const liste: AgendaGoogle[] = []
      let page: string | undefined
      do {
        const r = await appel<{ items?: { id: string; summary: string; summaryOverride?: string; primary?: boolean }[]; nextPageToken?: string }>(
          `/users/me/calendarList?minAccessRole=reader${page ? `&pageToken=${page}` : ''}`,
        )
        for (const c of r.items ?? []) liste.push({ id: c.id, nom: c.summaryOverride || c.summary, principal: !!c.primary })
        page = r.nextPageToken
      } while (page)
      return liste
    },
    async lister(calendrierId, du, au) {
      const evenements: EvenementGoogle[] = []
      let page: string | undefined
      do {
        const p = new URLSearchParams({ singleEvents: 'true', maxResults: '250', timeMin: du.toISOString(), timeMax: au.toISOString() })
        if (page) p.set('pageToken', page)
        const r = await appel<{ items?: EvenementGoogle[]; nextPageToken?: string }>(`/calendars/${cal(calendrierId)}/events?${p}`)
        evenements.push(...(r.items ?? []))
        page = r.nextPageToken
      } while (page)
      return evenements
    },
    inserer: (calendrierId, e) => appel(`/calendars/${cal(calendrierId)}/events`, { method: 'POST', body: JSON.stringify(e) }),
    remplacer: (calendrierId, e) => appel(`/calendars/${cal(calendrierId)}/events/${encodeURIComponent(e.id)}`, { method: 'PUT', body: JSON.stringify({ ...e, status: 'confirmed' }) }),
    supprimer: (calendrierId, id) => appel(`/calendars/${cal(calendrierId)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}
