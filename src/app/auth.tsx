import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { definirUtilisateur } from '@/data/appareil'
import { db } from '@/data/db'
import { arreterSynchronisation, demarrerSynchronisation } from '@/data/sync/service'
import { serveurConfigure, sessionMemorisee, supabase } from '@/data/sync/supabase'
import { confirmer } from '@/components/ui/Confirmation'

export type Role = 'admin' | 'collaborateur' | 'stagiaire'

export interface Profil {
  id: string
  email: string
  nom: string
  role: Role
}

type Etat =
  | { etape: 'chargement' }
  | { etape: 'local' }
  | { etape: 'deconnecte'; message?: string }
  | { etape: 'mot_de_passe'; session: Session }
  | { etape: 'connecte'; session: Session; profil: Profil | null }

interface Ctx {
  etat: Etat
  profil: Profil | null
  deconnecter: () => Promise<void>
  motDePasseChoisi: () => void
}

const Contexte = createContext<Ctx>({ etat: { etape: 'local' }, profil: null, deconnecter: async () => {}, motDePasseChoisi: () => {} })

// Lien d'invitation ou de mot de passe oublié : à lire avant que Supabase ne nettoie l'adresse.
const typeLien = typeof location !== 'undefined' ? new URLSearchParams(location.hash.slice(1)).get('type') : null
const CLE_PROFIL = 'auth.profil'
const MESSAGE_REVOQUE = 'Cet appareil a été déconnecté à distance. Ses données locales ont été effacées.'

/** Efface toutes les données de l'appareil (déconnexion ou appareil déconnecté à distance). */
async function effacerDonneesLocales() {
  arreterSynchronisation()
  db.close()
  await db.delete()
}

/** Appareil déconnecté à distance par un administrateur : on efface tout et on revient à la connexion. */
async function surRevoque() {
  await effacerDonneesLocales()
  await (await supabase()).auth.signOut({ scope: 'local' })
  sessionStorage.setItem('linkimmo.message', MESSAGE_REVOQUE)
  location.replace('/')
}

async function chargerProfil(session: Session): Promise<Profil | null> {
  try {
    const { data } = await (await supabase()).from('profils').select('id, email, nom, role').eq('id', session.user.id).maybeSingle()
    if (data) {
      await db.meta.put({ cle: CLE_PROFIL, valeur: data })
      return data as Profil
    }
  } catch {
    /* hors ligne : on reprend le profil mémorisé */
  }
  return ((await db.meta.get(CLE_PROFIL))?.valeur as Profil | undefined) ?? null
}

/**
 * État au démarrage : si une session est gardée sur l'appareil, l'application s'ouvre tout de suite
 * (le serveur confirme la session juste après, en arrière-plan).
 */
function etatInitial(): Etat {
  if (!serveurConfigure) return { etape: 'local' }
  const session = typeLien ? null : sessionMemorisee()
  if (!session) return { etape: 'chargement' }
  definirUtilisateur(session.user.id)
  return { etape: 'connecte', session, profil: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtatBrut] = useState<Etat>(etatInitial)
  const etatRef = useRef(etat)
  const setEtat = (e: Etat) => {
    etatRef.current = e
    setEtatBrut(e)
  }

  useEffect(() => {
    if (!serveurConfigure) return
    if (etatRef.current.etape === 'connecte')
      void db.meta.get(CLE_PROFIL).then((m) => m && etatRef.current.etape === 'connecte' && setEtat({ ...etatRef.current, profil: m.valeur as Profil }))
    let desabonner = () => {}
    void supabase().then((sb) => {
      const ouvrir = async (session: Session | null, doitChoisirMotDePasse = false) => {
        if (!session) {
          arreterSynchronisation()
          definirUtilisateur(null)
          const message = sessionStorage.getItem('linkimmo.message') ?? undefined
          sessionStorage.removeItem('linkimmo.message')
          setEtat({ etape: 'deconnecte', message })
          return
        }
        definirUtilisateur(session.user.id)
        if (doitChoisirMotDePasse) {
          setEtat({ etape: 'mot_de_passe', session })
          return
        }
        setEtat({ etape: 'connecte', session, profil: ((await db.meta.get(CLE_PROFIL))?.valeur as Profil | undefined) ?? null })
        demarrerSynchronisation(() => void surRevoque())
        const profil = await chargerProfil(session)
        if (etatRef.current.etape === 'connecte') setEtat({ ...etatRef.current, profil })
      }

      void sb.auth.getSession().then(({ data }) => ouvrir(data.session, typeLien === 'invite' || typeLien === 'recovery'))
      const { data } = sb.auth.onAuthStateChange((evenement, session) => {
        if (evenement === 'PASSWORD_RECOVERY') void ouvrir(session, true)
        else if (evenement === 'SIGNED_OUT') void ouvrir(null)
        else if (evenement === 'SIGNED_IN' && etatRef.current.etape === 'deconnecte') void ouvrir(session, typeLien === 'invite')
      })
      desabonner = () => data.subscription.unsubscribe()
    })
    return () => desabonner()
  }, [])

  const deconnecter = async () => {
    const enAttente = await db.outbox.count()
    if (
      enAttente > 0 &&
      !(await confirmer({
        titre: 'Se déconnecter quand même ?',
        message: `${enAttente} modification(s) n’ont pas encore été envoyées au serveur et seront perdues.`,
        confirmer: 'Se déconnecter',
        danger: true,
      }))
    )
      return
    await effacerDonneesLocales()
    await (await supabase()).auth.signOut({ scope: 'local' })
    location.replace('/')
  }

  const motDePasseChoisi = () => {
    const e = etatRef.current
    if (e.etape !== 'mot_de_passe') return
    history.replaceState(null, '', '/')
    setEtat({ etape: 'connecte', session: e.session, profil: null })
    demarrerSynchronisation(() => void surRevoque())
    void chargerProfil(e.session).then((profil) => {
      if (etatRef.current.etape === 'connecte') setEtat({ etape: 'connecte', session: e.session, profil })
    })
  }

  const profil = etat.etape === 'connecte' ? etat.profil : null
  return <Contexte.Provider value={{ etat, profil, deconnecter, motDePasseChoisi }}>{children}</Contexte.Provider>
}

export const useAuth = () => useContext(Contexte)

/** Traduction des messages d'erreur de connexion les plus courants. */
export function messageErreur(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.'
  if (/email not confirmed/i.test(message)) return 'Adresse email pas encore confirmée : ouvrez le lien reçu par email.'
  if (/password should be at least/i.test(message)) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (/fetch|network/i.test(message)) return 'Pas de connexion Internet. La première connexion nécessite Internet.'
  if (/same password/i.test(message)) return 'Choisissez un mot de passe différent de l’ancien.'
  return message
}
