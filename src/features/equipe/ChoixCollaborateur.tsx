import { UserRound } from 'lucide-react'
import { useEffect } from 'react'
import { Liste } from '@/components/ui/Champ'
import { nomMembre, rafraichirEquipe, useEquipe } from '@/services/equipe'

/**
 * « Qui s'en occupe ? » : collaborateur attitré d'une fiche ou d'une piste.
 * Ses relances vont dans son Google Agenda et ses notifications ; les autres voient qui suit le dossier.
 * Masqué tant que l'équipe ne compte qu'une personne.
 */
export function ChoixCollaborateur({ valeur, changer, parDefaut }: { valeur: string | null; changer: (id: string | null) => void; parDefaut?: string | null }) {
  const equipe = useEquipe()
  useEffect(() => void rafraichirEquipe(), [])
  const actifs = equipe.filter((m) => m.actif)
  if (actifs.length < 2) return null
  const auteur = nomMembre(equipe, parDefaut)
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
      <UserRound className="size-4 shrink-0 text-doux" aria-hidden />
      <span className="shrink-0 font-semibold text-doux">Suivi par</span>
      <Liste aria-label="Suivi par" value={valeur ?? ''} onChange={(e) => changer(e.target.value || null)} className="h-9 flex-1 bg-surface text-sm">
        <option value="">{auteur ? `${auteur} (a créé la fiche)` : 'Personne en particulier'}</option>
        {actifs.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom || m.email}
          </option>
        ))}
      </Liste>
    </label>
  )
}
