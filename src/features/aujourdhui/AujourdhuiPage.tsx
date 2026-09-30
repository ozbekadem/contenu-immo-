import { PartyPopper } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/Card'
import { FOND_COULEUR } from '@/components/ui/StatusDot'
import type { Couleur } from '@/domain/relance'
import type { FiltreRapide } from '@/features/contacts/filtres'
import { classer } from '@/domain/priorite'
import { SansAction, TopAppels } from './Sections'
import { useContactsColores } from '@/features/contacts/useContacts'

const TUILES: { couleur: Couleur; libelle: string; filtre: FiltreRapide }[] = [
  { couleur: 'rouge', libelle: 'En retard', filtre: 'retard' },
  { couleur: 'orange', libelle: "Aujourd'hui", filtre: 'aujourdhui' },
  { couleur: 'jaune', libelle: 'Semaine', filtre: 'semaine' },
  { couleur: 'vert', libelle: 'À jour', filtre: 'ajour' },
]

function salutation(d: Date): string {
  const h = d.getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

export default function AujourdhuiPage() {
  const { liste, maintenant } = useContactsColores()

  const { compte, aTraiter, top, sansAction } = useMemo(() => {
    const actifs = (liste ?? []).filter(({ contact }) => !contact.archivedAt)
    const compte = (c: Couleur) => actifs.filter((l) => l.couleur === c).length
    const top = classer(
      actifs.map((l) => ({ ...l, ...l.contact, couleur: l.couleur })),
      maintenant,
    ).map(({ element, priorite }) => ({ contact: element.contact, couleur: element.couleur, priorite }))
    const dansTop = new Set(top.map((t) => t.contact.id))
    // Toute fiche active doit avoir une prochaine action datée.
    const sansAction = actifs.filter(({ contact }) => !contact.nePasContacter && !contact.prochaineRelanceAt && !dansTop.has(contact.id))
    return { compte, aTraiter: compte('rouge') + compte('orange'), top, sansAction }
  }, [liste, maintenant])

  const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(maintenant)

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau d'accueil */}
      <section className="degrade relative overflow-hidden rounded-[28px] p-5 text-white shadow-primaire">
        <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <p className="relative text-sm font-semibold text-white/80 first-letter:uppercase">{date}</p>
        <h1 className="relative mt-1 text-[26px] font-extrabold leading-tight tracking-tight">{salutation(maintenant)} !</h1>
        <p className="relative mt-1 text-[15px] font-medium text-white/90">
          {liste === undefined
            ? '…'
            : aTraiter === 0
              ? 'Aucune relance urgente. Belle journée de prospection.'
              : `${aTraiter} relance${aTraiter > 1 ? 's' : ''} à traiter aujourd'hui.`}
        </p>

        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {TUILES.map(({ couleur, libelle, filtre }) => (
            <Link
              key={couleur}
              to={`/contacts?filtre=${filtre}`}
              className="presse relative rounded-2xl bg-white/15 px-1 pb-2.5 pt-3 text-center ring-1 ring-white/20 backdrop-blur"
            >
              <span className={`absolute right-2 top-2 size-2.5 rounded-full ring-2 ring-white/70 ${FOND_COULEUR[couleur]}`} />
              <div className="text-[26px] font-extrabold leading-none">{liste ? compte(couleur) : '–'}</div>
              <div className="mt-1.5 text-[11px] font-semibold leading-tight text-white/90">{libelle}</div>
            </Link>
          ))}
        </div>
      </section>

      <TopAppels lignes={top} />
      {aTraiter > top.length && (
        <Link to="/contacts?filtre=retard" className="-mt-2 px-4 text-center text-sm font-bold text-primaire-texte">
          Voir les {aTraiter - top.length} autres relances à traiter
        </Link>
      )}
      <SansAction lignes={sansAction} />

      {liste && aTraiter === 0 && (
        <Card className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-suivi-vert/12 text-suivi-vert">
            <PartyPopper className="size-5" />
          </span>
          <p className="text-sm font-medium">Tout est à jour. Profitez-en pour repérer de nouveaux biens !</p>
        </Card>
      )}
      <p className="px-4 text-center text-xs text-doux">Entonnoir, prospects à maturité, anniversaires et agenda arrivent à l’étape 6.</p>
    </div>
  )
}
