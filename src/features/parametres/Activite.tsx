import { useEffect, useState } from 'react'
import { definirActivite, definirDroitsParDefaut, useActivite, useDroitsParDefaut } from '@/app/activite'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Saisie } from '@/components/ui/Champ'
import { ACTIVITES, HYPOTHESES_DEFAUT } from '@/domain/achat'

/** Activité : agence (mandats), marchand de biens (achats) ou les deux ; taux des droits pour la calculette. */
export function Activite() {
  const activite = useActivite()
  const droits = useDroitsParDefaut()
  const [saisie, setSaisie] = useState('')
  useEffect(() => setSaisie(droits == null ? '' : String(droits).replace('.', ',')), [droits])
  const enregistrerDroits = () => {
    const n = Number(saisie.replace(',', '.').replace(/[^\d.]/g, ''))
    void definirDroitsParDefaut(saisie.trim() && Number.isFinite(n) && n > 0 && n < 30 ? n : null)
  }
  return (
    <div id="activite" className="scroll-mt-4">
      <Card>
        <SectionTitle>Activité</SectionTitle>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Activité">
          {ACTIVITES.map((a) => (
            <button
              key={a.code}
              type="button"
              role="radio"
              aria-checked={activite === a.code}
              onClick={() => definirActivite(a.code)}
              className={`presse rounded-2xl p-3 text-left ring-1 transition ${activite === a.code ? 'bg-primaire-doux ring-primaire/40' : 'bg-surface ring-bord'}`}
            >
              <span className={`block text-sm font-extrabold ${activite === a.code ? 'text-primaire-texte' : ''}`}>{a.libelle}</span>
              <span className="block text-xs text-doux">{a.detail}</span>
            </button>
          ))}
        </div>
        {activite !== 'agence' && (
          <label className="mt-4 block">
            <span className="text-[13px] font-semibold">Droits d’enregistrement pour vos achats (%)</span>
            <Saisie
              inputMode="decimal"
              className="mt-1"
              placeholder={`${String(HYPOTHESES_DEFAUT.droitsPct).replace('.', ',')} (taux normal en Wallonie)`}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onBlur={enregistrerDroits}
            />
            <span className="mt-1 block text-xs text-doux">
              Les marchands de biens enregistrés paient un taux réduit s’ils revendent dans le délai légal. Indiquez le taux que votre notaire vous applique : il sert de base à la calculette.
            </span>
          </label>
        )}
      </Card>
    </div>
  )
}
