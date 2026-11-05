import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initialiserDemo } from './data/demo'
import { chercherAdressesEnAttente } from './services/geocodage'
import { chercherInfosPubliquesEnAttente } from './services/infosPubliques'
import { demarrerGoogle } from './services/google'
import { ecouterInstallation } from './services/installation'
import { demarrerNotifications } from './services/notifications'
import { surveillerVerrou } from './services/verrou'
import './index.css'

// Demande au navigateur de ne jamais effacer la base locale (important sur iPhone).
navigator.storage?.persist?.().catch(() => {})
initialiserDemo().catch((e) => console.error('Données de démonstration', e))

// Repérages faits sans réseau : l'adresse est retrouvée dès que la connexion revient,
// puis les infos publiques du bien (cadastre, zone, risques) sont complétées.
const completer = () =>
  chercherAdressesEnAttente()
    .catch(() => 0)
    .then(() => chercherInfosPubliquesEnAttente())
    .catch(() => {})
if (import.meta.env.MODE !== 'apercu') {
  if (navigator.onLine) setTimeout(completer, 3000)
  window.addEventListener('online', completer)
}

// Google Agenda (si l'accès Google est configuré et que l'utilisateur l'a relié)
demarrerGoogle()

// Notifications (rappels affichés par l'application ; serveur si configuré) et invitation à installer
demarrerNotifications()
surveillerVerrou()
ecouterInstallation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
