import { useLiveQuery } from 'dexie-react-hooks'
import { Mail, MessageCircle, MessageSquare, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { confirmer } from '@/components/ui/Confirmation'
import { modeles } from '@/data/repositories/communication'
import type { Contact } from '@/data/types'
import { avertissementIndividuel, rendre, type CanalMessage } from '@/domain/communication'
import { lancerAction } from '@/features/actions/actions'
import { contexteDe, useSignature } from './contexte'

const ICONE: Record<CanalMessage, typeof Mail> = { sms: MessageSquare, whatsapp: MessageCircle, email: Mail }

/** Liste des modèles pour ce contact : un appui ouvre SMS / WhatsApp / email avec le texte déjà écrit. */
export function ListeMessagesTypes({ contact, numero, pisteId, fermer }: { contact: Contact; numero?: string | null; pisteId?: string | null; fermer: () => void }) {
  const liste = useLiveQuery(() => modeles.tous(), [])
  const signature = useSignature()
  const possible = (canal: CanalMessage) => (canal === 'email' ? contact.emails.length > 0 : contact._telNorm.length > 0)
  const utiliser = async (canal: CanalMessage, texte: string, sujet: string) => {
    const avert = avertissementIndividuel({ nePasContacter: contact.nePasContacter, aTelephone: true, aEmail: true, consentements: contact.consentements }, canal)
    if (avert && !(await confirmer({ titre: 'Envoyer quand même ?', message: avert, confirmer: 'Envoyer' }))) return
    fermer()
    lancerAction(contact, canal, numero, pisteId ?? null, texte, sujet)
  }
  const disponibles = (liste ?? []).filter((m) => possible(m.canal))
  return (
    <div className="flex max-h-[70dvh] flex-col gap-2 overflow-y-auto">
      {disponibles.length === 0 && <p className="text-sm text-doux">Aucun modèle utilisable (ajoutez un numéro ou un email au contact).</p>}
      {disponibles.map((m) => {
        const r = rendre(m.texte, contexteDe(contact, signature))
        const sujet = rendre(m.sujet, contexteDe(contact, signature)).texte
        const Icone = ICONE[m.canal]
        return (
          <button key={m.id} type="button" onClick={() => void utiliser(m.canal, r.texte, sujet)} className="presse rounded-2xl bg-surface-2 p-3 text-left">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Icone className="size-4 shrink-0 text-primaire-texte" aria-hidden /> {m.nom}
            </span>
            <span className="mt-1 line-clamp-2 block text-xs text-doux">{r.texte}</span>
            {r.manquantes.length > 0 && (
              <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-suivi-orange">
                <TriangleAlert className="size-3" aria-hidden /> Manque : {r.manquantes.join(', ')}
              </span>
            )}
          </button>
        )
      })}
      <Link to="/communication?onglet=modeles" onClick={fermer} className="mt-1 text-center text-xs font-bold text-primaire-texte">
        Gérer les modèles
      </Link>
    </div>
  )
}
