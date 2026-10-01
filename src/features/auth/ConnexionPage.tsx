import { KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { messageErreur, useAuth } from '@/app/auth'
import { classesBouton } from '@/components/ui/Bouton'
import { Champ, Saisie } from '@/components/ui/Champ'
import { supabase } from '@/data/sync/supabase'
import logo from '@/assets/logo.svg'

function Cadre({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="degrade pointer-events-none fixed inset-x-0 top-0 h-72 opacity-15 blur-3xl" />
      <div className="relative w-full max-w-sm animate-apparition">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="" className="size-20 rounded-[26px] shadow-primaire" />
          <h1 className="mt-5 text-[28px] font-extrabold tracking-tight">{titre}</h1>
          <p className="mt-1 text-sm font-medium text-doux">{sousTitre}</p>
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">{children}</div>
        <p className="mt-6 text-center text-xs text-doux">Données hébergées en Europe</p>
      </div>
    </div>
  )
}

export function ConnexionPage({ message }: { message?: string }) {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(message ?? null)
  const [occupe, setOccupe] = useState(false)

  const connecter = async (e: FormEvent) => {
    e.preventDefault()
    setErreur(null)
    if (!email.trim() || !motDePasse) return setErreur('Indiquez votre email et votre mot de passe.')
    setOccupe(true)
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: motDePasse })
    setOccupe(false)
    if (error) setErreur(messageErreur(error.message))
  }

  const oublie = async () => {
    setErreur(null)
    if (!email.trim()) {
      setErreur('Indiquez d’abord votre adresse email ci-dessus.')
      return
    }
    setOccupe(true)
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin })
    setOccupe(false)
    if (error) setErreur(messageErreur(error.message))
    else setInfo('Un email vient de vous être envoyé pour choisir un nouveau mot de passe.')
  }

  return (
    <Cadre titre="Linkimmo" sousTitre="Connectez-vous pour retrouver vos données sur tous vos appareils.">
      <form noValidate onSubmit={connecter} className="flex flex-col gap-4">
        <Champ libelle="Email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-doux" aria-hidden />
            <Saisie type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-11" required />
          </div>
        </Champ>
        <Champ libelle="Mot de passe">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-doux" aria-hidden />
            <Saisie type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className="pl-11" required />
          </div>
        </Champ>
        {erreur && <p role="alert" className="rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">{erreur}</p>}
        {info && <p className="rounded-2xl bg-primaire-doux p-3 text-sm font-semibold text-primaire-texte">{info}</p>}
        <button type="submit" disabled={occupe} className={`${classesBouton('primaire', 'lg')} w-full`}>
          {occupe ? 'Connexion…' : 'Se connecter'}
        </button>
        <button type="button" onClick={oublie} disabled={occupe} className="h-10 text-sm font-semibold text-primaire-texte">
          Mot de passe oublié ?
        </button>
      </form>
    </Cadre>
  )
}

export function NouveauMotDePassePage() {
  const { motDePasseChoisi } = useAuth()
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const valider = async (e: FormEvent) => {
    e.preventDefault()
    setErreur(null)
    if (mdp.length < 8) return setErreur('Le mot de passe doit contenir au moins 8 caractères.')
    if (mdp !== confirmation) return setErreur('Les deux mots de passe ne sont pas identiques.')
    setOccupe(true)
    const { error } = await supabase().auth.updateUser({ password: mdp })
    setOccupe(false)
    if (error) setErreur(messageErreur(error.message))
    else motDePasseChoisi()
  }

  return (
    <Cadre titre="Choisissez votre mot de passe" sousTitre="Il vous servira à vous connecter sur tous vos appareils.">
      <form noValidate onSubmit={valider} className="flex flex-col gap-4">
        <Champ libelle="Nouveau mot de passe" aide="Au moins 8 caractères.">
          <Saisie type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </Champ>
        <Champ libelle="Confirmer le mot de passe">
          <Saisie type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Champ>
        {erreur && <p role="alert" className="rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">{erreur}</p>}
        <button type="submit" disabled={occupe} className={`${classesBouton('primaire', 'lg')} w-full`}>
          {occupe ? 'Enregistrement…' : 'Valider et entrer'}
        </button>
      </form>
    </Cadre>
  )
}
