import { lazy } from 'react'
import { BarChart3, Building2, CalendarDays, Download, LineChart, MessageSquareText, Smartphone } from 'lucide-react'
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router'
import { Bientot } from '@/components/ui/Bientot'
import AujourdhuiPage from '@/features/aujourdhui/AujourdhuiPage'
import { Layout } from './Layout'
import { ThemeProvider } from './theme'
import { UpdatePrompt } from './UpdatePrompt'

// L'accueil est chargé immédiatement ; les autres écrans à la demande (ouverture plus rapide).
const ProspectionPage = lazy(() => import('@/features/prospection/ProspectionPage'))
const PlusPage = lazy(() => import('@/features/plus/PlusPage'))
const ParametresPage = lazy(() => import('@/features/parametres/ParametresPage'))
const RepererPage = lazy(() => import('@/features/reperer/RepererPage'))
const ContactsPage = lazy(() => import('@/features/contacts/ContactsPage'))
const ContactPage = lazy(() => import('@/features/contacts/ContactPage'))
const ContactFormPage = lazy(() => import('@/features/contacts/ContactFormPage'))

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <AujourdhuiPage /> },
      { path: 'prospection', element: <ProspectionPage /> },
      { path: 'reperer', element: <RepererPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'contacts/nouveau', element: <ContactFormPage /> },
      { path: 'contacts/:id', element: <ContactPage /> },
      { path: 'contacts/:id/modifier', element: <ContactFormPage key="modifier" /> },
      {
        path: 'agenda',
        element: (
          <Bientot titre="Agenda" icone={CalendarDays} etape={8}>
            Vues jour, semaine, mois et année, synchronisées avec Google Agenda.
          </Bientot>
        ),
      },
      { path: 'plus', element: <PlusPage /> },
      { path: 'biens', element: <Bientot titre="Biens" icone={Building2} etape={7}>Liste, carte, fiche, galerie photos, cadastre et documents.</Bientot> },
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

const router = createBrowserRouter(routes)

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </ThemeProvider>
  )
}
