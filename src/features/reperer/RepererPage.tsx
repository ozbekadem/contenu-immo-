import { Camera, X } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'

export default function RepererPage() {
  return (
    <div className="pt-[env(safe-area-inset-top)]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Repérer</h1>
        <Link to="/" className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label="Fermer">
          <X className="size-5" />
        </Link>
      </div>
      <EmptyState icone={Camera} titre="Capture terrain — étape 5">
        Photos multiples, position GPS, adresse automatique, catégorie et téléphone lu sur l'affiche, avec
        vérification immédiate des doublons — même sans réseau.
      </EmptyState>
    </div>
  )
}
