import { lazy } from 'react'
import { BarChart3, Download, LineChart, MessageSquareText, Smartphone } from 'lucide-react'
import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { Bientot } from '@/components/ui/Bientot'
import AujourdhuiPage from '@/features/aujourdhui/AujourdhuiPage'
import { ConnexionPage, NouveauMotDePassePage } from '@/features/auth/ConnexionPage'
import { AuthProvider, useAuth } from './auth'
import { Layout } from './Layout'
import { ThemeProvider } from './theme'
import { UpdatePrompt } from './UpdatePrompt'
import { ZoneConfirmation } from '@/components/ui/Confirmation'

// L'accueil est chargé immédiatement ; les autres écrans à la demande (ouverture plus rapide).
const ProspectionPage = lazy(() => import('@/features/prospection/ProspectionPage'))
const PlusPage = lazy(() => import('@/features/plus/PlusPage'))
const ParametresPage = lazy(() => import('@/features/parametres/ParametresPage'))
const RepererPage = lazy(() => import('@/features/reperer/RepererPage'))
const ContactsPage = lazy(() => import('@/features/contacts/ContactsPage'))
const ContactPage = lazy(() => import('@/features/contacts/ContactPage'))
const ContactFormPage = lazy(() => import('@/features/contacts/ContactFormPage'))
const PistePage = lazy(() => import('@/features/prospection/PistePage'))
const BiensPage = lazy(() => import('@/features/biens/BiensPage'))
const BienPage = lazy(() => import('@/features/biens/BienPage'))
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'))
const SessionPage = lazy(() => import('@/features/session/SessionPage'))
const ArgumentairesPage = lazy(() => import('@/features/argumentaires/ArgumentairesPage'))

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <AujourdhuiPage /> },
      { path: 'prospection', element: <ProspectionPage /> },
      { path: 'reperer', element: <RepererPage /> },
      { path: 'pistes/:id', element: <PistePage /> },
      { path: 'session', element: <SessionPage /> },
      { path: 'argumentaires', element: <ArgumentairesPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'contacts/nouveau', element: <ContactFormPage /> },
      { path: 'contacts/:id', element: <ContactPage /> },
      { path: 'contacts/:id/modifier', element: <ContactFormPage key="modifier" /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'plus', element: <PlusPage /> },
      { path: 'biens', element: <BiensPage /> },
      { path: 'biens/:id', element: <BienPage /> },
      { path: 'marche', element: <Bientot titre="Marché local" icone={LineChart} etape={10}>Prix médians Statbel par quartier et par commune.</Bientot> },
      { path: 'communication', element: <Bientot titre="Communication" icone={MessageSquareText} etape={11}>Modèles de messages, campagnes et contrôle RGPD.</Bientot> },
      { path: 'equipe', element: <Bientot titre="Équipe et statistiques" icone={BarChart3} etape={12}>Collaborateurs, rôles, activité et conversion.</Bientot> },
      { path: 'import-export', element: <Bientot titre="Import, export, sauvegarde" icone={Download} etape={13}>Import CSV et Excel, export, sauvegardes JSON.</Bientot> },
      { path: 'installer', element: <Bientot titre="Installer l'application" icone={Smartphone} etape={9}>Guide pas à pas pour iPhone et Android.</Bientot> },
      { path: 'parametres', element: <ParametresPage /> },
      { path: '*', element: <AujourdhuiPage /> },
    ],
  },
]

// L'aperçu de démonstration tourne dans un cadre sans barre d'adresse : navigation en mémoire.
const router = import.meta.env.MODE === 'apercu' ? createMemoryRouter(routes) : createBrowserRouter(routes)

/** Affiche l'application si l'utilisateur est connecté (ou en mode local), sinon l'écran de connexion. */
function Portail() {
  const { etat } = useAuth()
  switch (etat.etape) {
    case 'chargement':
      return null
    case 'deconnecte':
      return <ConnexionPage message={etat.message} />
    case 'mot_de_passe':
      return <NouveauMotDePassePage />
    default:
      return <RouterProvider router={router} />
  }
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Portail />
      </AuthProvider>
      {import.meta.env.MODE !== 'apercu' && <UpdatePrompt />}
      <ZoneConfirmation />
    </ThemeProvider>
  )
}
