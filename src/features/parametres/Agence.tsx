import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { definirNomAgence, useNomAgence } from '@/app/agence'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Saisie } from '@/components/ui/Champ'

/** Nom de l'agence : repris dans les argumentaires d'appel et les messages (anniversaires…). */
export function Agence() {
  const nom = useNomAgence()
  const [saisie, setSaisie] = useState('')
  const [ok, setOk] = useState(false)
  useEffect(() => setSaisie(nom ?? ''), [nom])
  const enregistrer = async () => {
    await definirNomAgence(saisie)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }
  return (
    <div id="agence" className="scroll-mt-4">
      <Card>
        <SectionTitle>Votre agence</SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-doux">Facultatif. Remplace [agence] dans les argumentaires et signe les messages de vœux.</p>
        <div className="flex gap-2">
          <Saisie aria-label="Nom de l’agence" placeholder="Nom de l’agence" value={saisie} onChange={(e) => setSaisie(e.target.value)} className="flex-1" />
          <button type="button" onClick={enregistrer} className={`${classesBouton('primaire')} h-12 px-4`}>
            {ok ? <Check className="size-5" aria-label="Enregistré" /> : 'OK'}
          </button>
        </div>
      </Card>
    </div>
  )
}
