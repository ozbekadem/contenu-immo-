import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initialiserDemo } from './data/demo'
import { chercherAdressesEnAttente } from './services/geocodage'
import './index.css'

// Demande au navigateur de ne jamais effacer la base locale (important sur iPhone).
navigator.storage?.persist?.().catch(() => {})
initialiserDemo().catch((e) => console.error('Données de démonstration', e))

// Repérages faits sans réseau : l'adresse est retrouvée dès que la connexion revient.
const adresses = () => chercherAdressesEnAttente().catch(() => {})
if (navigator.onLine) setTimeout(adresses, 3000)
window.addEventListener('online', adresses)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
