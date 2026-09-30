import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ChoixTheme } from '@/app/theme'
import { Card, SectionTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PARAMETRES_DEFAUT, SEUILS_ROUGE_DEFAUT } from '@/domain/relance'
import { CATEGORIES } from '@/domain/categories'
import { DonneesDemo } from './DonneesDemo'

const CHOIX: { code: ChoixTheme; libelle: string; icone: typeof Sun }[] = [
  { code: 'auto', libelle: 'Automatique', icone: Monitor },
  { code: 'clair', libelle: 'Clair', icone: Sun },
  { code: 'sombre', libelle: 'Sombre', icone: Moon },
]

export default function ParametresPage() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <PageHeader titre="Paramètres" />
      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Apparence</SectionTitle>
          <div role="radiogroup" aria-label="Thème" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1">
            {CHOIX.map(({ code, libelle, icone: Icone }) => (
              <button
                key={code}
                role="radio"
                aria-checked={theme === code}
                onClick={() => setTheme(code)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                  theme === code ? 'bg-surface shadow-sm' : 'text-doux'
                }`}
              >
                <Icone className="size-4" aria-hidden />
                {libelle}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Codes couleur (valeurs par défaut)</SectionTitle>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.map((c) => (
              <li key={c.code} className="flex justify-between gap-2">
                <span>{c.libelle}</span>
                <span className="font-semibold">rouge après {SEUILS_ROUGE_DEFAUT[c.code]} jours sans contact</span>
              </li>
            ))}
            <li className="flex justify-between gap-2 border-t border-bord pt-2">
              <span>Relance « proche » (jaune)</span>
              <span className="font-semibold">dans les {PARAMETRES_DEFAUT.horizonJauneJours} jours</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-doux">Ces seuils deviendront modifiables à l'étape 12.</p>
        </Card>

        <DonneesDemo />

        <p className="text-center text-xs text-doux">Linkimmo · version {__APP_VERSION__}</p>
      </div>
    </>
  )
}
