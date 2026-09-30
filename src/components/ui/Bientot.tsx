import type { LucideIcon } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { EmptyState } from './EmptyState'

/** Écran provisoire d'un module pas encore développé. */
export function Bientot({ titre, icone, etape, children }: { titre: string; icone: LucideIcon; etape: number; children: string }) {
  return (
    <>
      <PageHeader titre={titre} />
      <EmptyState icone={icone} titre={`Arrive à l'étape ${etape}`}>
        {children}
      </EmptyState>
    </>
  )
}
