import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Puce, Saisie } from '@/components/ui/Champ'
import { Feuille } from '@/components/ui/Feuille'
import { contacts } from '@/data/repositories/contacts'
import type { Contact } from '@/data/types'
import { CANAUX_MESSAGE, LIBELLE_CONSENTEMENT, type CanalMessage, type Consentement, type EtatConsentement } from '@/domain/communication'

const TEINTE: Record<EtatConsentement, string> = {
  accorde: 'bg-suivi-vert/12 text-suivi-vert',
  refuse: 'bg-suivi-rouge/10 text-suivi-rouge',
  retire: 'bg-suivi-rouge/10 text-suivi-rouge',
}
const aujourdhui = () => new Date().toISOString().slice(0, 10)
const dateLisible = (j: string) => new Date(`${j}T12:00:00`).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })

function Formulaire({ contact, canal, fermer }: { contact: Contact; canal: CanalMessage; fermer: () => void }) {
  const actuel = contact.consentements?.[canal]
  const [etat, setEtat] = useState<EtatConsentement>(actuel?.etat ?? 'accorde')
  const [date, setDate] = useState(actuel?.date ?? aujourdhui())
  const [preuve, setPreuve] = useState(actuel?.preuve ?? '')
  const enregistrer = async (c: Consentement | null) => {
    const suivants = { ...contact.consentements }
    if (c) suivants[canal] = c
    else delete suivants[canal]
    await contacts.modifier(contact.id, { consentements: suivants })
    fermer()
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="radiogroup" aria-label="Consentement">
        {(Object.keys(LIBELLE_CONSENTEMENT) as EtatConsentement[]).map((e) => (
          <Puce key={e} actif={etat === e} onClick={() => setEtat(e)}>
            {LIBELLE_CONSENTEMENT[e]}
          </Puce>
        ))}
      </div>
      <Champ libelle="Date">
        <Saisie type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Champ>
      <Champ libelle="Comment ? (preuve)" aide="Ex. « accord oral lors de l’appel du 2/10 », « a répondu STOP », « formulaire signé ».">
        <Saisie value={preuve} placeholder={etat === 'accorde' ? 'Accord oral lors de l’appel' : 'A répondu STOP'} onChange={(e) => setPreuve(e.target.value)} />
      </Champ>
      <div className="flex gap-2">
        {actuel && (
          <button type="button" onClick={() => enregistrer(null)} className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl text-doux`}>
            Effacer
          </button>
        )}
        <button
          type="button"
          onClick={() => enregistrer({ etat, date: date || aujourdhui(), preuve: preuve.trim() || (etat === 'accorde' ? 'Accord oral' : 'Refus oral') })}
          className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}

/** Accords RGPD du contact, canal par canal (exigés pour les campagnes ; tracés au journal). */
export function ConsentementsContact({ contact }: { contact: Contact }) {
  const [canal, setCanal] = useState<CanalMessage | null>(null)
  return (
    <Card>
      <SectionTitle>
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primaire-texte" aria-hidden /> Consentements (RGPD)
        </span>
      </SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-doux">Nécessaires pour inclure ce contact dans une campagne. Un message individuel reste possible.</p>
      <ul className="flex flex-col gap-2">
        {CANAUX_MESSAGE.map(({ code, libelle }) => {
          const c = contact.consentements?.[code]
          return (
            <li key={code}>
              <button type="button" onClick={() => setCanal(code)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-left active:opacity-70" aria-label={`Consentement ${libelle}`}>
                <span className="w-20 text-sm font-bold">{libelle}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-doux">{c ? `${dateLisible(c.date)} · ${c.preuve}` : 'Non renseigné'}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${c ? TEINTE[c.etat] : 'bg-surface text-doux'}`}>{c ? LIBELLE_CONSENTEMENT[c.etat] : '—'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <Feuille titre={`Consentement ${CANAUX_MESSAGE.find((c) => c.code === canal)?.libelle ?? ''}`} ouverte={canal !== null} fermer={() => setCanal(null)}>
        {canal && <Formulaire key={canal} contact={contact} canal={canal} fermer={() => setCanal(null)} />}
      </Feuille>
    </Card>
  )
}
