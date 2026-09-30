import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { db } from '@/data/db'
import { genererContactsTest, supprimerDemo } from '@/data/demo'
import { confirmer } from '@/components/ui/Confirmation'

export function DonneesDemo() {
  const nbDemo = useLiveQuery(() => db.contacts.filter((c) => c._demo === true).count(), [])
  const [occupe, setOccupe] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const generer = async () => {
    setOccupe('Génération de 5 000 contacts…')
    const debut = performance.now()
    await genererContactsTest(5000)
    setMessage(`5 000 contacts de test créés en ${((performance.now() - debut) / 1000).toFixed(1)} s.`)
    setOccupe(null)
  }

  const supprimer = async () => {
    const ok = await confirmer({
      titre: `Supprimer les ${nbDemo} contacts de démonstration ?`,
      message: 'Suppression définitive. Vos vrais contacts ne sont pas touchés.',
      confirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setOccupe('Suppression…')
    const n = await supprimerDemo()
    setMessage(`${n.toLocaleString('fr-BE')} contacts de démonstration supprimés.`)
    setOccupe(null)
  }

  return (
    <Card>
      <SectionTitle>Données de démonstration</SectionTitle>
      <p className="text-sm text-doux">
        {nbDemo === undefined ? '…' : `${nbDemo.toLocaleString('fr-BE')} contact(s) de démonstration sur cet appareil.`} Elles restent sur
        cet appareil et ne sont jamais synchronisées.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!!occupe || !nbDemo}
          onClick={supprimer}
          className={`${classesBouton('danger')} h-12 flex-1 rounded-2xl`}
        >
          Supprimer les données de démonstration
        </button>
        <button
          type="button"
          disabled={!!occupe}
          onClick={generer}
          className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl`}
        >
          Test de vitesse : générer 5 000 contacts
        </button>
      </div>
      {(occupe || message) && <p className="mt-2 text-sm font-semibold">{occupe ?? message}</p>}
    </Card>
  )
}
