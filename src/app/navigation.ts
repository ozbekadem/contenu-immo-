import {
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  Home,
  LineChart,
  Menu,
  MessageSquareQuote,
  MessageSquareText,
  Settings,
  Smartphone,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface EntreeNav {
  chemin: string
  libelle: string
  icone: LucideIcon
}

/** Onglets du bas (smartphone). */
export const ONGLETS: EntreeNav[] = [
  { chemin: '/', libelle: "Aujourd'hui", icone: Home },
  { chemin: '/prospection', libelle: 'Prospection', icone: Target },
  { chemin: '/contacts', libelle: 'Contacts', icone: Users },
  { chemin: '/agenda', libelle: 'Agenda', icone: CalendarDays },
  { chemin: '/plus', libelle: 'Plus', icone: Menu },
]

/** Modules secondaires (menu « Plus » sur smartphone, barre latérale sur ordinateur). */
export const MODULES: (EntreeNav & { description: string })[] = [
  { chemin: '/biens', libelle: 'Biens', icone: Building2, description: 'Liste, carte, photos, cadastre' },
  { chemin: '/argumentaires', libelle: 'Argumentaires d’appel', icone: MessageSquareQuote, description: 'Phrases et réponses aux objections' },
  { chemin: '/marche', libelle: 'Marché local', icone: LineChart, description: 'Prix Statbel par quartier et commune' },
  { chemin: '/communication', libelle: 'Communication', icone: MessageSquareText, description: 'Modèles de messages et campagnes' },
  { chemin: '/equipe', libelle: 'Équipe et statistiques', icone: BarChart3, description: 'Collaborateurs, activité, conversion' },
  { chemin: '/import-export', libelle: 'Import, export, sauvegarde', icone: Download, description: 'CSV, Excel, sauvegardes JSON' },
  { chemin: '/installer', libelle: "Installer l'application", icone: Smartphone, description: 'Guide iPhone et Android' },
  { chemin: '/parametres', libelle: 'Paramètres', icone: Settings, description: 'Apparence, seuils, notifications' },
]
