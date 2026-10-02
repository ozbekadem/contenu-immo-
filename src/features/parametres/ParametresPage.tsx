import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { PALETTES, useTheme, type ChoixTheme } from '@/app/theme'
import { Card, SectionTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PARAMETRES_DEFAUT, SEUILS_ROUGE_DEFAUT } from '@/domain/relance'
import { CATEGORIES } from '@/domain/categories'
import { CarteGoogle } from '@/features/agenda/composants'
import { Agence } from './Agence'
import { Notifications } from './Notifications'
import { Verrouillage } from './Verrouillage'
import { CompteSync } from './CompteSync'
import { DonneesDemo } from './DonneesDemo'

const POINT = { portefeuille: 'bg-portefeuille', annonce: 'bg-annonce', maison_vide: 'bg-maison-vide' } as const

const CHOIX: { code: ChoixTheme; libelle: string; icone: typeof Sun }[] = [
  { code: 'auto', libelle: 'Automatique', icone: Monitor },
  { code: 'clair', libelle: 'Clair', icone: Sun },
  { code: 'sombre', libelle: 'Sombre', icone: Moon },
]

export default function ParametresPage() {
  const { theme, setTheme, palette, setPalette } = useTheme()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])
  return (
    <>
      <PageHeader titre="Paramètres" />
      <div className="flex flex-col gap-4">
        <CompteSync />
        <Agence />
        <CarteGoogle />
        <Notifications />
        <Verrouillage />

        <Card>
          <SectionTitle>Apparence</SectionTitle>
          <div role="radiogroup" aria-label="Thème" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1">
            {CHOIX.map(({ code, libelle, icone: Icone }) => (
              <button
                key={code}
                role="radio"
                aria-checked={theme === code}
                onClick={() => setTheme(code)}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-bold transition-all ${
                  theme === code ? 'bg-surface text-primaire-texte shadow-carte' : 'text-doux'
                }`}
              >
                <Icone className="size-5" aria-hidden />
                {libelle}
              </button>
            ))}
          </div>

          <div className="mt-5 text-[13px] font-semibold text-doux">Couleur de l’application</div>
          <div role="radiogroup" aria-label="Couleur" className="mt-2 grid grid-cols-3 gap-3">
            {PALETTES.map(({ code, libelle, couleurs: [a, b] }) => (
              <button
                key={code}
                role="radio"
                aria-checked={palette === code}
                onClick={() => setPalette(code)}
                className={`presse flex flex-col items-center gap-2 rounded-2xl p-3 text-sm font-bold ring-2 transition ${
                  palette === code ? 'bg-primaire-doux ring-primaire' : 'bg-surface-2 ring-transparent'
                }`}
              >
                <span className="grid size-12 place-items-center rounded-full text-white shadow-carte" style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}>
                  {palette === code && <Check className="size-6" strokeWidth={3} />}
                </span>
                {libelle}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Codes couleur</SectionTitle>
          <p className="-mt-1 mb-3 text-sm text-doux">Passage au rouge sans contact ni relance planifiée :</p>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`size-2.5 rounded-full ${POINT[c.code]}`} />
                  {c.libelle}
                </span>
                <span className="rounded-full bg-suivi-rouge/12 px-2.5 py-1 text-xs font-bold text-suivi-rouge">{SEUILS_ROUGE_DEFAUT[c.code]} jours</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
              <span className="font-semibold">Relance proche (jaune)</span>
              <span className="rounded-full bg-suivi-jaune/15 px-2.5 py-1 text-xs font-bold text-[#a16207] dark:text-suivi-jaune">
                {PARAMETRES_DEFAUT.horizonJauneJours} jours avant
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-doux">Ces seuils deviendront modifiables à l'étape 12.</p>
        </Card>

        <DonneesDemo />

        <p className="text-center text-xs text-doux">Prospect’Immo · version {__APP_VERSION__}</p>
      </div>
    </>
  )
}
