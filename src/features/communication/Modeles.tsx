import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Mail, MessageCircle, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { classesBouton } from '@/components/ui/Bouton'
import { Card } from '@/components/ui/Card'
import { Champ, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { Feuille } from '@/components/ui/Feuille'
import { modeles, type ModeleVue } from '@/data/repositories/communication'
import { CANAUX_MESSAGE, rendre, VARIABLES, type CanalMessage, type ContenuModele } from '@/domain/communication'
import { useSignature } from './contexte'

export const ICONE_CANAL: Record<CanalMessage, typeof Mail> = { sms: MessageSquare, whatsapp: MessageCircle, email: Mail }

/** Contact d'exemple pour l'aperçu des modèles. */
const EXEMPLE = { civilite: 'M.', prenom: 'Marc', nom: 'Dupont', ville: 'Gosselies' }

/** Texte avec boutons d'insertion des variables et aperçu personnalisé. */
export function EditeurTexte({ texte, setTexte, sujet, setSujet, canal }: { texte: string; setTexte: (t: string) => void; sujet: string; setSujet: (s: string) => void; canal: CanalMessage }) {
  const zone = useRef<HTMLTextAreaElement>(null)
  const signature = useSignature()
  const inserer = (code: string) => {
    const el = zone.current
    const pos = el?.selectionStart ?? texte.length
    const suivant = `${texte.slice(0, pos)}{{${code}}}${texte.slice(el?.selectionEnd ?? pos)}`
    setTexte(suivant)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos + code.length + 4, pos + code.length + 4)
    })
  }
  const apercu = rendre(texte, { ...EXEMPLE, ...signature })
  return (
    <div className="flex flex-col gap-3">
      {canal === 'email' && (
        <Champ libelle="Objet">
          <Saisie value={sujet} onChange={(e) => setSujet(e.target.value)} />
        </Champ>
      )}
      <Champ libelle="Message">
        <Zone ref={zone} rows={6} value={texte} onChange={(e) => setTexte(e.target.value)} />
      </Champ>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Insérer une information">
        {VARIABLES.map((v) => (
          <button key={v.code} type="button" onClick={() => inserer(v.code)} className="presse h-8 rounded-full bg-primaire-doux px-3 text-xs font-bold text-primaire-texte">
            + {v.libelle}
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-2 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-doux">Aperçu pour {EXEMPLE.prenom} {EXEMPLE.nom}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{apercu.texte || '…'}</p>
        {canal === 'sms' && <p className="mt-1 text-[11px] text-doux">{apercu.texte.length} caractères{apercu.texte.length > 160 ? ` (${Math.ceil(apercu.texte.length / 153)} SMS)` : ''}</p>}
      </div>
    </div>
  )
}

function FormulaireModele({ existant, fermer }: { existant: ModeleVue | null; fermer: () => void }) {
  const copie = existant?.fourni
  const [nom, setNom] = useState(existant ? `${existant.nom}${copie ? ' (copie)' : ''}` : '')
  const [canal, setCanal] = useState<CanalMessage>(existant?.canal ?? 'sms')
  const [sujet, setSujet] = useState(existant?.sujet ?? '')
  const [texte, setTexte] = useState(existant?.texte ?? '{{bonjour}}, ')
  const enregistrer = async () => {
    const donnees: ContenuModele = { nom: nom.trim() || 'Sans titre', canal, sujet: canal === 'email' ? sujet.trim() : '', texte: texte.trim() }
    if (existant && !existant.fourni) await modeles.modifier(existant.id, donnees)
    else await modeles.creer(donnees)
    fermer()
  }
  const supprimer = async () => {
    if (!existant || existant.fourni) return
    if (await confirmer({ titre: 'Supprimer ce modèle ?', message: 'Il est archivé : les messages déjà envoyés restent dans l’historique.', confirmer: 'Supprimer' })) {
      await modeles.archiver(existant.id)
      fermer()
    }
  }
  return (
    <div className="flex max-h-[78dvh] flex-col gap-4 overflow-y-auto pb-1">
      <Champ libelle="Nom du modèle">
        <Saisie value={nom} onChange={(e) => setNom(e.target.value)} />
      </Champ>
      <div className="flex gap-2" role="group" aria-label="Canal">
        {CANAUX_MESSAGE.map((c) => (
          <Puce key={c.code} actif={canal === c.code} onClick={() => setCanal(c.code)}>
            {c.libelle}
          </Puce>
        ))}
      </div>
      <EditeurTexte texte={texte} setTexte={setTexte} sujet={sujet} setSujet={setSujet} canal={canal} />
      <div className="sticky bottom-0 flex gap-2 bg-surface pt-1">
        {existant && !existant.fourni && (
          <button type="button" onClick={supprimer} className={`${classesBouton('fantome')} h-12 w-12 shrink-0 rounded-2xl !px-0 text-suivi-rouge`} aria-label="Supprimer le modèle">
            <Trash2 className="size-5" />
          </button>
        )}
        <button type="button" onClick={fermer} className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl`}>
          Annuler
        </button>
        <button type="button" onClick={enregistrer} className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}

/** Onglet « Modèles » : ceux de l'agence (modifiables) et ceux fournis (à dupliquer). */
export function Modeles() {
  const liste = useLiveQuery(() => modeles.tous(), [])
  const [ouvert, setOuvert] = useState<ModeleVue | 'nouveau' | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setOuvert('nouveau')} className={`${classesBouton('primaire')} w-full`}>
        <Plus className="size-5" aria-hidden /> Nouveau modèle
      </button>
      <Card className="overflow-hidden !p-0">
        <ul>
          {(liste ?? []).map((m) => {
            const Icone = ICONE_CANAL[m.canal]
            return (
              <li key={m.id} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
                <button type="button" onClick={() => setOuvert(m)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-2">
                  <Icone className="mt-0.5 size-5 shrink-0 text-primaire-texte" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[15px] font-bold">
                      {m.nom}
                      {m.fourni && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-doux">fourni</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-doux">{m.texte}</span>
                  </span>
                  {m.fourni && <Copy className="mt-0.5 size-4 shrink-0 text-doux" aria-label="Dupliquer pour modifier" />}
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
      <p className="px-2 text-center text-xs text-doux">Les modèles fournis se dupliquent pour être adaptés. Vos modèles sont partagés avec toute l’équipe.</p>
      <Feuille titre={ouvert === 'nouveau' ? 'Nouveau modèle' : ouvert?.fourni ? 'Dupliquer le modèle' : 'Modifier le modèle'} ouverte={ouvert !== null} fermer={() => setOuvert(null)}>
        {ouvert !== null && <FormulaireModele key={ouvert === 'nouveau' ? 'n' : ouvert.id} existant={ouvert === 'nouveau' ? null : ouvert} fermer={() => setOuvert(null)} />}
      </Feuille>
    </div>
  )
}
