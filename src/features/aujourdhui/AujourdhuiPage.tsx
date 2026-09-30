import { ChevronRight, PartyPopper } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/Card'
import { FOND_COULEUR } from '@/components/ui/StatusDot'
import type { Couleur } from '@/domain/relance'
import { ContactLigne } from '@/features/contacts/ContactLigne'
import type { ContactColore, FiltreRapide } from '@/features/contacts/filtres'
import { useContactsColores } from '@/features/contacts/useContacts'

const TUILES: { couleur: Couleur; libelle: string; filtre: FiltreRapide }[] = [
  { couleur: 'rouge', libelle: 'En retard', filtre: 'retard' },
  { couleur: 'orange', libelle: "Aujourd'hui", filtre: 'aujourdhui' },
  { couleur: 'jaune', libelle: 'Semaine', filtre: 'semaine' },
  { couleur: 'vert', libelle: 'À jour', filtre: 'tous' },
]

/** Nombre maximum de lignes par section sur l'accueil (le reste via « Tout voir »). */
const MAX = 8

function salutation(d: Date): string {
  const h = d.getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

function Section({ titre, couleur, lignes, filtre, maintenant }: { titre: string; couleur: Couleur; lignes: ContactColore[]; filtre: FiltreRapide; maintenant: Date }) {
  if (lignes.length === 0) return null
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span className={`size-2.5 rounded-full ${FOND_COULEUR[couleur]}`} />
          {titre}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-doux">{lignes.length}</span>
        </h2>
        {lignes.length > MAX && (
          <Link to={`/contacts?filtre=${filtre}`} className="flex items-center text-sm font-bold text-primaire-texte">
            Tout voir <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="divide-y divide-bord/70 pb-1">
        {lignes.slice(0, MAX).map(({ contact, couleur: c }) => (
          <ContactLigne key={contact.id} contact={contact} couleur={c} maintenant={maintenant} />
        ))}
      </div>
    </Card>
  )
}

export default function AujourdhuiPage() {
  const { liste, maintenant } = useContactsColores()

  const { compte, retard, aujourdhui } = useMemo(() => {
    const actifs = (liste ?? []).filter(({ contact }) => !contact.archivedAt)
    const compte = (c: Couleur) => actifs.filter((l) => l.couleur === c).length
    // Les plus en retard d'abord (relance la plus ancienne).
    const retard = actifs
      .filter((l) => l.couleur === 'rouge')
      .sort((a, b) =>
        (a.contact.prochaineRelanceAt ?? a.contact.dernierContactAt ?? '').localeCompare(b.contact.prochaineRelanceAt ?? b.contact.dernierContactAt ?? ''),
      )
    return { compte, retard, aujourdhui: actifs.filter((l) => l.couleur === 'orange') }
  }, [liste])

  const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(maintenant)
  const aTraiter = retard.length + aujourdhui.length

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
              to={filtre === 'tous' ? '/contacts' : `/contacts?filtre=${filtre}`}
              className="presse relative rounded-2xl bg-white/15 px-1 pb-2.5 pt-3 text-center ring-1 ring-white/20 backdrop-blur"
            >
              <span className={`absolute right-2 top-2 size-2.5 rounded-full ring-2 ring-white/70 ${FOND_COULEUR[couleur]}`} />
              <div className="text-[26px] font-extrabold leading-none">{liste ? compte(couleur) : '–'}</div>
              <div className="mt-1.5 text-[11px] font-semibold leading-tight text-white/90">{libelle}</div>
            </Link>
          ))}
        </div>
      </section>

      <Section titre="À appeler aujourd'hui" couleur="orange" lignes={aujourdhui} filtre="aujourdhui" maintenant={maintenant} />
      <Section titre="En retard" couleur="rouge" lignes={retard} filtre="retard" maintenant={maintenant} />

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
