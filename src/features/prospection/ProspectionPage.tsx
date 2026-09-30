import { Briefcase, DoorOpen, Signpost } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CATEGORIES } from '@/domain/categories'

const STYLE = {
  portefeuille: { fond: 'from-portefeuille to-[#6d9bff]', icone: Briefcase },
  annonce: { fond: 'from-annonce to-[#ffb347]', icone: Signpost },
  maison_vide: { fond: 'from-maison-vide to-[#d18cff]', icone: DoorOpen },
} as const

export default function ProspectionPage() {
  return (
    <>
      <PageHeader titre="Prospection" sousTitre="Pistes, carte et session d'appels — étape 5" />
      <div className="grid gap-3 sm:grid-cols-3">
        {CATEGORIES.map((c) => {
          const { fond, icone: Icone } = STYLE[c.code]
          return (
            <section key={c.code} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-carte ${fond}`}>
              <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/15" />
              <span className="relative grid size-11 place-items-center rounded-2xl bg-white/20">
                <Icone className="size-5" aria-hidden />
              </span>
              <h2 className="relative mt-3 text-lg font-extrabold">{c.libelle}</h2>
              <p className="relative mt-1 text-sm text-white/90">{c.description}</p>
            </section>
          )
        })}
      </div>
    </>
  )
}
