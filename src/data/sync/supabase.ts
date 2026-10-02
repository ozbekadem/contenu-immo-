import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Transport } from './transport'

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CLE_PUBLIQUE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Le serveur est-il configuré ? Sinon l'application fonctionne en « mode local » (un seul appareil). */
export const serveurConfigure = !!(URL_SUPABASE && CLE_PUBLIQUE)

const CLE_SESSION = 'linkimmo.session'
let client: Promise<SupabaseClient> | null = null

/**
 * Client du serveur, chargé à la demande (≈ 55 Ko) : l'application s'affiche d'abord,
 * la bibliothèque du serveur arrive juste après.
 */
export function supabase(): Promise<SupabaseClient> {
  if (!serveurConfigure) return Promise.reject(new Error('Serveur non configuré'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_SUPABASE!, CLE_PUBLIQUE!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: CLE_SESSION },
    }),
  )
  return client
}

/** Session gardée sur l'appareil lors de la dernière connexion (lue sans charger la bibliothèque du serveur). */
export function sessionMemorisee(): Session | null {
  if (!serveurConfigure) return null
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SESSION) ?? 'null') as Session | null
    return s?.access_token && s.user?.id ? s : null
  } catch {
    return null
  }
}

function verifier<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data
}

export function transportSupabase(): Transport {
  return {
    async push(ops, appareil) {
      const sb = await supabase()
      const r = verifier(await sb.rpc('sync_push', { ops, appareil }))
      return r as { rejets: { entite: string; id: string; champ: string }[] }
    },
    async pull(depuis, limite) {
      const sb = await supabase()
      return verifier(await sb.from('enregistrements').select('*').gt('server_seq', depuis).order('server_seq').limit(limite)) ?? []
    },
    async pushJournal(entrees) {
      const sb = await supabase()
      verifier(await sb.from('journal').upsert(entrees, { onConflict: 'id', ignoreDuplicates: true }))
    },
    async pullJournal(depuis, limite) {
      const sb = await supabase()
      return verifier(await sb.from('journal').select('*').gt('server_seq', depuis).order('server_seq').limit(limite)) ?? []
    },
    async envoyerFichier(chemin, contenu) {
      const sb = await supabase()
      const { error } = await sb.storage.from('fichiers').upload(chemin, contenu, { upsert: false, contentType: contenu.type || undefined })
      // Déjà envoyé lors d'une tentative précédente interrompue : c'est bon.
      if (error && !/exists|Duplicate/i.test(error.message)) throw new Error(error.message)
    },
    async telechargerFichier(chemin) {
      const sb = await supabase()
      const blob = verifier(await sb.storage.from('fichiers').download(chemin))
      if (!blob) throw new Error('Fichier introuvable sur le serveur')
      return blob
    },
    async signalerAppareil(id, nom) {
      const sb = await supabase()
      const { data: session } = await sb.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('Session expirée')
      const existant = verifier(await sb.from('appareils').select('revoque').eq('user_id', userId).eq('id', id).maybeSingle())
      if (existant?.revoque) return { revoque: true }
      if (existant) verifier(await sb.from('appareils').update({ derniere_activite: new Date().toISOString(), nom }).eq('user_id', userId).eq('id', id))
      else verifier(await sb.from('appareils').insert({ id, nom }))
      return { revoque: false }
    },
    ecouter(surChangement) {
      let arrete = false
      const canal = supabase().then((sb) => {
        if (arrete) return null
        return sb
          .channel('linkimmo-changements')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'enregistrements' }, surChangement)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal' }, surChangement)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appareils' }, surChangement)
          .subscribe()
      })
      return () => {
        arrete = true
        void Promise.all([supabase(), canal]).then(([sb, c]) => c && sb.removeChannel(c))
      }
    },
  }
}
