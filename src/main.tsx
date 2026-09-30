import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initialiserDemo } from './data/demo'
import './index.css'

// Demande au navigateur de ne jamais effacer la base locale (important sur iPhone).
navigator.storage?.persist?.().catch(() => {})
initialiserDemo().catch((e) => console.error('Données de démonstration', e))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
