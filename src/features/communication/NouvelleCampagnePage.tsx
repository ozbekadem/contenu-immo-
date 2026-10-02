import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ShieldAlert, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Liste, Puce, Saisie } from '@/components/ui/Champ'
import { db } from '@/data/db'
import { campagnes, FILTRES_VIDES, modeles, repartir, selectionner } from '@/data/repositories/communication'
import { SOURCES_CONTACT, STATUTS_CONTACT, type FiltresCampagne } from '@/data/types'
import { avecDesinscription, CANAUX_MESSAGE, LIBELLE_BLOCAGE, rendre, VARIABLES, type CanalMessage, type RaisonBlocage } from '@/domain/communication'
import { nomAffiche } from '@/features/contacts/affichage'
import { contexteDe, useSignature } from './contexte'
import { EditeurTexte } from './Modeles'

const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

/** Nouvelle campagne : message, destinataires (filtres), contrôle RGPD, puis envoi un par un. */
export default function NouvelleCampagnePage() {
  const navigate = useNavigate()
  const signature = useSignature()
  const [nom, setNom] = useState('')
  const [canal, setCanal] = useState<CanalMessage>('sms')
  const [modeleId, setModeleId] = useState('')
  const [sujet, setSujet] = useState('')
  const [texte, setTexte] = useState('{{bonjour}}, ')
  const [filtres, setFiltres] = useState<FiltresCampagne>(FILTRES_VIDES)
  const [localites, setLocalites] = useState('')
  const [voirBloques, setVoirBloques] = useState(false)
  const [occupe, setOccupe] = useState(false)

  const listeModeles = useLiveQuery(() => modeles.tous(canal), [canal])
  const contacts = useLiveQuery(() => db.contacts.toArray(), [])
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const f = useMemo(() => ({ ...filtres, localites: localites.split(',').map((x) => x.trim()).filter(Boolean) }), [filtres, localites])
  const repartition = useMemo(() => (contacts ? repartir(selectionner(contacts, f), canal, aujourdhui) : null), [contacts, f, canal, aujourdhui])
  const parRaison = useMemo(() => {
    const m = new Map<RaisonBlocage, number>()
    for (const b of repartition?.bloques ?? []) m.set(b.raison, (m.get(b.raison) ?? 0) + 1)
    return [...m]
  }, [repartition])

  const choisirModele = (id: string) => {
    setModeleId(id)
    const m = listeModeles?.find((x) => x.id === id)
    if (m) {
      setTexte(m.texte)
      setSujet(m.sujet)
      if (!nom) setNom(m.nom)
    }
  }
  const texteFinal = avecDesinscription(texte, canal)
  const premier = repartition?.aEnvoyer[0]
  // Destinataires à qui il manque une information utilisée dans le message (prénom, ville…)
  const incomplets = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of repartition?.aEnvoyer ?? [])
      for (const v of new Set([...rendre(texte, contexteDe(c, signature)).manquantes, ...rendre(sujet, contexteDe(c, signature)).manquantes]))
        if (v !== 'agent' && v !== 'agence') m.set(v, (m.get(v) ?? 0) + 1)
    return [...m]
  }, [repartition, texte, sujet, signature])

  const lancer = async () => {
    if (!repartition) return
    setOccupe(true)
    const c = await campagnes.lancer({ nom: nom.trim() || 'Campagne', canal, sujet: sujet.trim(), texte: texteFinal, filtres: f }, repartition)
    navigate(`/communication/${c.id}`, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight">Nouvelle campagne</h1>
      </div>

      <Card className="flex flex-col gap-4">
        <SectionTitle>1. Le message</SectionTitle>
        <div className="flex gap-2" role="group" aria-label="Canal">
          {CANAUX_MESSAGE.map((c) => (
            <Puce
              key={c.code}
              actif={canal === c.code}
              onClick={() => {
                setCanal(c.code)
                setModeleId('')
              }}
            >
              {c.libelle}
            </Puce>
          ))}
        </div>
        <Champ libelle="Partir d’un modèle (facultatif)">
          <Liste value={modeleId} onChange={(e) => choisirModele(e.target.value)}>
            <option value="">— Texte libre —</option>
            {listeModeles?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </Liste>
        </Champ>
        <Champ libelle="Nom de la campagne">
          <Saisie value={nom} placeholder="Ex. Vœux 2027, anciens clients Gosselies…" onChange={(e) => setNom(e.target.value)} />
        </Champ>
        <EditeurTexte texte={texte} setTexte={setTexte} sujet={sujet} setSujet={setSujet} canal={canal} />
        {texteFinal !== texte && <p className="text-xs text-doux">La mention « Répondez STOP… » sera ajoutée à la fin (obligatoire pour une campagne).</p>}
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>2. Les destinataires</SectionTitle>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-doux">Statut (aucun = tous)</p>
          <div className="flex flex-wrap gap-2">
            {STATUTS_CONTACT.map((s) => (
              <Puce key={s.code} actif={filtres.statuts.includes(s.code)} onClick={() => setFiltres({ ...filtres, statuts: basculer(filtres.statuts, s.code) })}>
                {s.libelle}
              </Puce>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-doux">Origine (aucune = toutes)</p>
          <div className="flex flex-wrap gap-2">
            {SOURCES_CONTACT.map((s) => (
              <Puce key={s.code} actif={filtres.sources.includes(s.code)} onClick={() => setFiltres({ ...filtres, sources: basculer(filtres.sources, s.code) })}>
                {s.libelle.replace(/ \(.*\)/, '')}
              </Puce>
            ))}
          </div>
        </div>
        <Champ libelle="Localités ou codes postaux (séparés par des virgules)">
          <Saisie value={localites} placeholder="Ex. Gosselies, 6001, Jumet" onChange={(e) => setLocalites(e.target.value)} />
        </Champ>
        <Champ libelle="Sans échange depuis">
          <Liste value={filtres.sansContactDepuisMois ?? ''} onChange={(e) => setFiltres({ ...filtres, sansContactDepuisMois: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Peu importe</option>
            <option value="3">au moins 3 mois</option>
            <option value="6">au moins 6 mois</option>
            <option value="12">au moins 1 an</option>
          </Liste>
        </Champ>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>3. Contrôle RGPD</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-suivi-vert/12 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-suivi-vert">
              <ShieldCheck className="size-4" aria-hidden /> Recevront le message
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{repartition?.aEnvoyer.length ?? '–'}</p>
          </div>
          <div className="rounded-2xl bg-suivi-rouge/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-suivi-rouge">
              <ShieldAlert className="size-4" aria-hidden /> Bloqués
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{repartition?.bloques.length ?? '–'}</p>
          </div>
        </div>
        {parRaison.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {parRaison.map(([r, n]) => (
              <li key={r} className="flex justify-between">
                <span className="text-doux">{LIBELLE_BLOCAGE[r]}</span>
                <strong className="tabular-nums">{n}</strong>
              </li>
            ))}
          </ul>
        )}
        {(repartition?.bloques.length ?? 0) > 0 && (
          <button type="button" onClick={() => setVoirBloques(!voirBloques)} className="self-start text-xs font-bold text-primaire-texte">
            {voirBloques ? 'Masquer' : 'Voir'} les contacts bloqués
          </button>
        )}
        {voirBloques && (
          <ul className="max-h-60 overflow-y-auto rounded-2xl bg-surface-2 p-2 text-sm">
            {repartition!.bloques.map(({ contact, raison }) => (
              <li key={contact.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <Link to={`/contacts/${contact.id}`} className="truncate font-semibold underline-offset-2 hover:underline">
                  {nomAffiche(contact)}
                </Link>
                <span className="shrink-0 text-xs text-doux">{LIBELLE_BLOCAGE[raison]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-doux">
          Une campagne n’est envoyée qu’aux contacts qui ont donné leur accord pour ce canal (fiche du contact → Consentements). Les contacts bloqués restent notés dans la campagne.
        </p>
      </Card>

      {incomplets.length > 0 && (
        <p className="rounded-2xl bg-suivi-orange/10 p-3 text-sm">
          <strong>Information manquante :</strong>{' '}
          {incomplets.map(([v, n]) => `${VARIABLES.find((x) => x.code === v)?.libelle.toLowerCase() ?? v} absent(e) pour ${n} destinataire${n > 1 ? 's' : ''}`).join(', ')}. Vérifiez l’aperçu : la
          phrase doit rester correcte sans cette information.
        </p>
      )}
      {premier && (
        <Card>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Users className="size-5 text-primaire-texte" aria-hidden /> Aperçu pour {nomAffiche(premier)}
            </span>
          </SectionTitle>
          {canal === 'email' && <p className="text-sm font-bold">{rendre(sujet, contexteDe(premier, signature)).texte}</p>}
          <p className="mt-1 whitespace-pre-wrap text-sm">{rendre(texteFinal, contexteDe(premier, signature)).texte}</p>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-fond via-fond/95 to-fond/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <button type="button" disabled={occupe || !repartition?.aEnvoyer.length || !texte.trim()} onClick={lancer} className={`${classesBouton('primaire', 'lg')} mx-auto w-full max-w-5xl`}>
          {repartition?.aEnvoyer.length ? `Préparer l’envoi à ${repartition.aEnvoyer.length} contact${repartition.aEnvoyer.length > 1 ? 's' : ''}` : 'Aucun destinataire autorisé'}
        </button>
      </div>
    </div>
  )
}
