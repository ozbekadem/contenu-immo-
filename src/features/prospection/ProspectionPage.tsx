import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { CATEGORIES } from '@/domain/categories'

const BORD = {
  portefeuille: 'border-l-portefeuille',
  annonce: 'border-l-annonce',
  maison_vide: 'border-l-maison-vide',
} as const

export default function ProspectionPage() {
  return (
    <>
      <PageHeader titre="Prospection" sousTitre="Pistes, carte et session d'appels — étape 5" />
      <div className="grid gap-3 sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Card key={c.code} className={`border-l-4 ${BORD[c.code]}`}>
            <h2 className="font-bold">{c.libelle}</h2>
            <p className="mt-1 text-sm text-doux">{c.description}</p>
          </Card>
        ))}
      </div>
    </>
  )
}
