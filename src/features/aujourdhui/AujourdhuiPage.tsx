import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Card, SectionTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusDot } from '@/components/ui/StatusDot'
import type { Couleur } from '@/domain/relance'
import { ContactLigne } from '@/features/contacts/ContactLigne'
import type { ContactColore, FiltreRapide } from '@/features/contacts/filtres'
import { useContactsColores } from '@/features/contacts/useContacts'

const TUILES: { couleur: Couleur; libelle: string; filtre: FiltreRapide }[] = [
  { couleur: 'rouge', libelle: 'En retard', filtre: 'retard' },
  { couleur: 'orange', libelle: "Aujourd'hui", filtre: 'aujourdhui' },
  { couleur: 'jaune', libelle: 'Cette semaine', filtre: 'semaine' },
  { couleur: 'vert', libelle: 'À jour', filtre: 'tous' },
]

/** Nombre maximum de lignes par section sur l'accueil (le reste via « Tout voir »). */
const MAX = 8

function Section({ titre, lignes, filtre, maintenant }: { titre: string; lignes: ContactColore[]; filtre: FiltreRapide; maintenant: Date }) {
  if (lignes.length === 0) return null
  return (
    <Card className="!px-0 !pb-0">
      <div className="px-4">
        <SectionTitle
          action={
            lignes.length > MAX && (
              <Link to={`/contacts?filtre=${filtre}`} className="flex items-center text-sm font-semibold">
                Tout voir ({lignes.length}) <ChevronRight className="size-4" />
              </Link>
            )
          }
        >
          {titre}
        </SectionTitle>
      </div>
      <div className="[&>a:last-child]:border-b-0">
        {lignes.slice(0, MAX).map(({ contact, couleur }) => (
          <ContactLigne key={contact.id} contact={contact} couleur={couleur} maintenant={maintenant} />
        ))}
      </div>
    </Card>
  )
}

export default function AujourdhuiPage() {
  const { liste, maintenant } = useContactsColores()

  const { parCouleur, retard, aujourdhui } = useMemo(() => {
    const actifs = (liste ?? []).filter(({ contact }) => !contact.archivedAt)
    const parCouleur = (c: Couleur) => actifs.filter((l) => l.couleur === c)
    // Les plus en retard d'abord (relance la plus ancienne).
    const retard = parCouleur('rouge').sort((a, b) =>
      (a.contact.prochaineRelanceAt ?? a.contact.dernierContactAt ?? '').localeCompare(b.contact.prochaineRelanceAt ?? b.contact.dernierContactAt ?? ''),
    )
    return { parCouleur, retard, aujourdhui: parCouleur('orange') }
  }, [liste])

  const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(maintenant)

  return (
    <>
      <PageHeader titre="Aujourd'hui" sousTitre={<span className="inline-block first-letter:uppercase">{date}</span>} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TUILES.map(({ couleur, libelle, filtre }) => (
          <Link key={couleur} to={filtre === 'tous' ? '/contacts' : `/contacts?filtre=${filtre}`}>
            <Card className="!p-3 transition-transform active:scale-[0.98]">
              <div className="flex items-center gap-2 text-sm text-doux">
                <StatusDot couleur={couleur} taille="sm" />
                {libelle}
              </div>
              <div className="mt-1 text-2xl font-extrabold">{liste ? parCouleur(couleur).length : '–'}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Section titre="À appeler aujourd'hui" lignes={aujourdhui} filtre="aujourdhui" maintenant={maintenant} />
        <Section titre="En retard" lignes={retard} filtre="retard" maintenant={maintenant} />
        {liste && aujourdhui.length + retard.length === 0 && (
          <Card>
            <p className="text-center text-sm text-doux">Rien à rappeler aujourd’hui. Bonne prospection !</p>
          </Card>
        )}
        <p className="text-center text-xs text-doux">Entonnoir, prospects à maturité, anniversaires et agenda arrivent à l’étape 6.</p>
      </div>
    </>
  )
}
