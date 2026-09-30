import { Phone } from 'lucide-react'
import { Card, SectionTitle } from '@/components/ui/Card'
import { CategorieBadge, TemperatureBadge } from '@/components/ui/Badges'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusDot } from '@/components/ui/StatusDot'
import { ajouterJours } from '@/domain/dates'
import {
  couleurSuivi,
  libelleDernierContact,
  libelleProchaineRelance,
  parametresPour,
  type Categorie,
  type Couleur,
  type EtatSuivi,
  type Temperature,
} from '@/domain/relance'
import { formaterTelephone } from '@/domain/telephone'

interface Exemple extends EtatSuivi {
  nom: string
  ville: string
  telephone: string
  categorie: Categorie
  temperature: Temperature
}

/** Exemples fictifs pour visualiser les codes couleur (remplacés par les vraies données à l'étape 2). */
function exemples(maintenant: Date): Exemple[] {
  const j = (n: number) => ajouterJours(maintenant, n)
  return [
    { nom: 'Rue de Montigny 112', ville: 'Charleroi', telephone: '0471234501', categorie: 'maison_vide', temperature: 'froid', prochaineRelanceAt: j(-4), dernierContactAt: j(-60) },
    { nom: 'M. Dupont', ville: 'Gosselies', telephone: '0472234502', categorie: 'annonce', temperature: 'tiede', prochaineRelanceAt: j(0), dernierContactAt: j(-7) },
    { nom: 'Mme Lambert', ville: 'Marcinelle', telephone: '0473234503', categorie: 'portefeuille', temperature: 'tiede', prochaineRelanceAt: j(3), dernierContactAt: j(-87) },
    { nom: 'M. et Mme Rossi', ville: 'Jumet', telephone: '0474234504', categorie: 'annonce', temperature: 'chaud', dernierResultatPositif: true, prochaineRelanceAt: j(21), dernierContactAt: j(-1) },
    { nom: 'Mme Claes', ville: 'Montignies-sur-Sambre', telephone: '0475234505', categorie: 'portefeuille', temperature: 'froid', dernierContactAt: j(-120) },
    { nom: 'Avenue Pastur 8', ville: 'Mont-sur-Marchienne', telephone: '0476234506', categorie: 'maison_vide', temperature: 'froid', nePasRappeler: true, dernierContactAt: j(-30) },
  ]
}

const ORDRE: Couleur[] = ['rouge', 'orange', 'jaune', 'vert', 'gris']

const TUILES: { couleur: Couleur; libelle: string }[] = [
  { couleur: 'rouge', libelle: 'En retard' },
  { couleur: 'orange', libelle: "Aujourd'hui" },
  { couleur: 'jaune', libelle: 'Cette semaine' },
  { couleur: 'vert', libelle: 'À jour' },
]

export default function AujourdhuiPage() {
  const maintenant = new Date()
  const lignes = exemples(maintenant)
    .map((e) => ({ ...e, couleur: couleurSuivi(e, parametresPour(e.categorie), maintenant) }))
    .sort((a, b) => ORDRE.indexOf(a.couleur) - ORDRE.indexOf(b.couleur))

  const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(maintenant)

  return (
    <>
      <PageHeader titre="Aujourd'hui" sousTitre={<span className="inline-block first-letter:uppercase">{date}</span>} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TUILES.map(({ couleur, libelle }) => (
          <Card key={couleur} className="!p-3">
            <div className="flex items-center gap-2 text-sm text-doux">
              <StatusDot couleur={couleur} taille="sm" />
              {libelle}
            </div>
            <div className="mt-1 text-2xl font-extrabold">{lignes.filter((l) => l.couleur === couleur).length}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle action={<span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">Aperçu</span>}>
          À appeler
        </SectionTitle>
        <ul className="-mx-4 divide-y divide-bord">
          {lignes.map((l) => (
            <li key={l.nom} className="flex items-center gap-3 px-4 py-3">
              <StatusDot couleur={l.couleur} taille="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-semibold">{l.nom}</span>
                  <CategorieBadge categorie={l.categorie} court />
                  <TemperatureBadge temperature={l.temperature} />
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-doux">
                  <div>{l.ville} · Dernier contact : {libelleDernierContact(l.dernierContactAt, maintenant)}</div>
                  <div>
                    Prochaine relance :{' '}
                    <span className={`font-semibold ${l.couleur === 'rouge' ? 'text-suivi-rouge' : l.couleur === 'orange' ? 'text-suivi-orange' : 'text-texte'}`}>
                      {libelleProchaineRelance(l.prochaineRelanceAt, maintenant)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled
                title={`${formaterTelephone(l.telephone)} — le menu d'appel arrive à l'étape 4`}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-bord bg-surface-2 text-doux"
              >
                <Phone className="size-5" aria-hidden />
                <span className="sr-only">Appeler {l.nom}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-doux">
          Exemples fictifs pour visualiser les codes couleur. Vos vraies relances apparaîtront ici dès l'étape 2.
        </p>
      </Card>
    </>
  )
}
