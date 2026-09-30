import { AlertTriangle, CloudCheck, CloudOff, HardDrive, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { useEtatSync } from '@/data/sync/service'
import type { StatutSync } from '@/data/sync/moteur'

const ASPECT: Record<StatutSync, { libelle: string; classe: string }> = {
  a_jour: { libelle: 'Synchronisé', classe: 'bg-suivi-vert/12 text-suivi-vert' },
  en_cours: { libelle: 'Synchronisation…', classe: 'bg-primaire-doux text-primaire-texte' },
  hors_ligne: { libelle: 'Hors ligne', classe: 'bg-surface-2 text-doux' },
  erreur: { libelle: 'Erreur de synchronisation', classe: 'bg-suivi-rouge/12 text-suivi-rouge' },
  revoque: { libelle: 'Appareil déconnecté', classe: 'bg-suivi-rouge/12 text-suivi-rouge' },
  local: { libelle: 'Mode local', classe: 'bg-surface-2 text-doux' },
}

/** Petit indicateur de synchronisation (en-tête) ; un appui ouvre les détails dans Paramètres. */
export function IndicateurSync({ avecTexte = false }: { avecTexte?: boolean }) {
  const { statut, enAttente } = useEtatSync()
  const { libelle, classe } = ASPECT[statut]
  const Icone =
    statut === 'a_jour' ? CloudCheck : statut === 'en_cours' ? RefreshCw : statut === 'hors_ligne' ? CloudOff : statut === 'local' ? HardDrive : AlertTriangle
  const texte = statut === 'hors_ligne' && enAttente > 0 ? `${enAttente} en attente` : libelle
  return (
    <Link
      to="/parametres#compte"
      title={texte}
      aria-label={texte}
      className={`presse inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${classe}`}
    >
      <Icone className={`size-4 ${statut === 'en_cours' ? 'animate-spin' : ''}`} aria-hidden />
      {(avecTexte || (statut === 'hors_ligne' && enAttente > 0)) && <span>{texte}</span>}
    </Link>
  )
}
