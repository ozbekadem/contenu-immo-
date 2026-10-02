import { Bell, Check, Download, EllipsisVertical, MonitorDown, PlusSquare, Share, Smartphone } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { installer, useInstallation } from '@/services/installation'
import { estInstallee, estIos } from '@/services/notifications'

type Appareil = 'iphone' | 'android' | 'ordinateur'

function appareil(): Appareil {
  if (estIos()) return 'iphone'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return 'ordinateur'
}

function Etapes({ etapes }: { etapes: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {etapes.map((e, i) => (
        <li key={i} className="flex gap-3">
          <span className="degrade grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white">{i + 1}</span>
          <span className="pt-0.5 text-[15px] leading-snug">{e}</span>
        </li>
      ))}
    </ol>
  )
}

const Icone = ({ children }: { children: ReactNode }) => <span className="mx-0.5 inline-grid size-7 place-items-center rounded-lg bg-surface-2 align-middle">{children}</span>

const ETAPES: Record<Appareil, { titre: string; etapes: ReactNode[] }> = {
  iphone: {
    titre: 'iPhone et iPad (Safari)',
    etapes: [
      <>Ouvrez Prospect’Immo dans <strong>Safari</strong> (pas dans Chrome ni depuis une autre application).</>,
      <>
        Touchez le bouton <strong>Partager</strong>
        <Icone>
          <Share className="size-4" aria-hidden />
        </Icone>
        en bas de l’écran (en haut sur iPad).
      </>,
      <>
        Faites défiler et touchez <strong>« Sur l’écran d’accueil »</strong>
        <Icone>
          <PlusSquare className="size-4" aria-hidden />
        </Icone>
        , puis <strong>Ajouter</strong>.
      </>,
      <>Ouvrez Prospect’Immo depuis sa nouvelle icône, puis activez les notifications (ci-dessous).</>,
    ],
  },
  android: {
    titre: 'Android (Chrome)',
    etapes: [
      <>Ouvrez Prospect’Immo dans <strong>Chrome</strong>.</>,
      <>
        Touchez <strong>Installer Prospect’Immo</strong> en haut de cette page (s’il apparaît), ou le menu
        <Icone>
          <EllipsisVertical className="size-4" aria-hidden />
        </Icone>
        → <strong>« Installer l’application »</strong> (ou « Ajouter à l’écran d’accueil »).
      </>,
      <>Confirmez : l’icône Prospect’Immo apparaît avec vos autres applications.</>,
      <>Appui long sur l’icône : raccourcis Repérer, Session d’appels, Nouveau contact.</>,
    ],
  },
  ordinateur: {
    titre: 'Ordinateur (Chrome ou Edge)',
    etapes: [
      <>
        Cliquez sur <strong>Installer</strong> ci-dessus, ou sur l’icône
        <Icone>
          <MonitorDown className="size-4" aria-hidden />
        </Icone>
        à droite de la barre d’adresse.
      </>,
      <>Prospect’Immo s’ouvre dans sa propre fenêtre et apparaît dans le menu Démarrer / le Dock.</>,
    ],
  },
}

/** Guide d'installation de l'application (iPhone, Android, ordinateur) et des notifications. */
export default function InstallerPage() {
  const { possible, installee } = useInstallation()
  const deja = installee || estInstallee()
  const ici = appareil()
  const autres = (['iphone', 'android', 'ordinateur'] as Appareil[]).filter((a) => a !== ici)

  return (
    <>
      <PageHeader titre="Installer l’application" sousTitre="Une icône sur l’écran d’accueil, plein écran, utilisable sans réseau." />
      <div className="flex flex-col gap-4">
        {deja ? (
          <Card className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-suivi-vert/12 text-suivi-vert">
              <Check className="size-6" aria-hidden />
            </span>
            <p className="text-sm font-semibold">Prospect’Immo est installée sur cet appareil.</p>
          </Card>
        ) : (
          possible && (
            <button type="button" onClick={() => void installer()} className={`${classesBouton('primaire', 'lg')} w-full`}>
              <Download className="size-5" aria-hidden /> Installer Prospect’Immo
            </button>
          )
        )}

        <Card>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Smartphone className="size-5 text-primaire-texte" aria-hidden /> {ETAPES[ici].titre}
            </span>
          </SectionTitle>
          <Etapes etapes={ETAPES[ici].etapes} />
          {ici === 'iphone' && <p className="mt-3 text-xs text-doux">iOS 16.4 ou plus récent est nécessaire pour les notifications.</p>}
        </Card>

        <Card>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Bell className="size-5 text-primaire-texte" aria-hidden /> Puis activer les notifications
            </span>
          </SectionTitle>
          <Etapes
            etapes={[
              <>
                Ouvrez <strong>Plus → Paramètres → Notifications</strong> et touchez <strong>Activer</strong>.
              </>,
              <>Acceptez quand le téléphone demande l’autorisation.</>,
              <>Une notification d’essai « Les notifications sont activées » s’affiche.</>,
            ]}
          />
          <Link to="/parametres#notifications" className={`${classesBouton('secondaire')} mt-4 w-full`}>
            Aller aux notifications
          </Link>
        </Card>

        {autres.map((a) => (
          <details key={a} className="rounded-3xl bg-surface p-4 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">
            <summary className="cursor-pointer font-bold">{ETAPES[a].titre}</summary>
            <div className="mt-3">
              <Etapes etapes={ETAPES[a].etapes} />
            </div>
          </details>
        ))}
      </div>
    </>
  )
}
