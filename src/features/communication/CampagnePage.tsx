import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, ExternalLink, ShieldAlert, SkipForward } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { db } from '@/data/db'
import { campagnes } from '@/data/repositories/communication'
import type { Contact, Envoi } from '@/data/types'
import { CANAUX_MESSAGE, LIBELLE_BLOCAGE, rendre } from '@/domain/communication'
import { lienEmail, lienSms, lienWhatsapp } from '@/domain/telephone'
import { ouvrirLien } from '@/features/actions/actions'
import { nomAffiche } from '@/features/contacts/affichage'
import { contexteDe, useSignature } from './contexte'
import { ICONE_CANAL } from './Modeles'

const LIBELLE_ETAT: Record<Envoi['etat'], string> = { a_envoyer: 'À envoyer', envoye: 'Envoyé', bloque: 'Bloqué', ignore: 'Passé' }

/** Une campagne : envoi un par un (chaque message s'ouvre déjà écrit dans le téléphone), suivi des états. */
export default function CampagnePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const signature = useSignature()
  const campagne = useLiveQuery(() => campagnes.get(id), [id], null)
  const donnees = useLiveQuery(async () => {
    const envois = await campagnes.envois.deCampagne(id)
    const contacts = new Map((await db.contacts.bulkGet(envois.map((e) => e.contactId))).filter((c): c is Contact => !!c).map((c) => [c.id, c]))
    return { envois, contacts }
  }, [id])
  const compte = useMemo(() => {
    const c = { a_envoyer: 0, envoye: 0, bloque: 0, ignore: 0 }
    for (const e of donnees?.envois ?? []) c[e.etat]++
    return c
  }, [donnees])

  if (campagne === null || !donnees) return null
  if (!campagne) return <p className="py-16 text-center text-doux">Cette campagne n’existe pas (ou plus sur cet appareil).</p>

  const restants = donnees.envois.filter((e) => e.etat === 'a_envoyer')
  const suivant = restants[0]
  const contact = suivant ? donnees.contacts.get(suivant.contactId) : undefined
  const message = contact ? rendre(campagne.texte, contexteDe(contact, signature)).texte : ''
  const sujet = contact ? rendre(campagne.sujet, contexteDe(contact, signature)).texte : ''
  const Icone = ICONE_CANAL[campagne.canal]
  const libelleCanal = CANAUX_MESSAGE.find((c) => c.code === campagne.canal)!.libelle
  const lien = contact
    ? campagne.canal === 'email'
      ? contact.emails[0] && lienEmail(contact.emails[0], sujet, message)
      : contact._telNorm[0] && (campagne.canal === 'sms' ? lienSms(contact._telNorm[0], message) : lienWhatsapp(contact._telNorm[0], message))
    : null

  const envoyer = async () => {
    if (!lien || !suivant) return
    // Le téléphone ouvre le message déjà écrit : c'est vous qui appuyez sur « Envoyer ».
    ouvrirLien(lien)
    await campagnes.marquerEnvoye(campagne, suivant, message)
  }

  const total = compte.a_envoyer + compte.envoye + compte.ignore
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/communication')} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{campagne.nom}</h1>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-doux">
            <Icone className="size-3.5" aria-hidden /> {libelleCanal} · {compte.envoye} / {total} envoyé{compte.envoye > 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={total - compte.a_envoyer} aria-label="Avancement">
        <div className="degrade h-full rounded-full transition-all" style={{ width: `${total ? ((total - compte.a_envoyer) / total) * 100 : 100}%` }} />
      </div>

      {suivant && contact ? (
        <Card className="ring-2 ring-primaire/25">
          <p className="text-xs font-bold uppercase tracking-wide text-primaire-texte">
            Suivant · {total - compte.a_envoyer + 1} sur {total}
          </p>
          <Link to={`/contacts/${contact.id}`} className="mt-1 block text-lg font-extrabold">
            {nomAffiche(contact)}
          </Link>
          {campagne.canal === 'email' && <p className="mt-2 text-sm font-bold">{sujet}</p>}
          <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-sm">{message}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void campagnes.ignorer(suivant)} className={`${classesBouton('secondaire', 'lg')} w-28 flex-col !gap-0 text-xs`}>
              <SkipForward className="size-5" aria-hidden /> Passer
            </button>
            <button type="button" disabled={!lien} onClick={envoyer} className={`${classesBouton('primaire', 'lg')} flex-1`}>
              <ExternalLink className="size-5" aria-hidden /> Ouvrir {libelleCanal}
            </button>
          </div>
          <p className="mt-2 text-xs text-doux">Le message s’ouvre déjà écrit : appuyez sur « Envoyer » dans {libelleCanal}, puis revenez ici pour le suivant.</p>
        </Card>
      ) : (
        <Card className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-suivi-vert/12 text-suivi-vert">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="text-sm font-semibold">
            Campagne terminée : {compte.envoye} envoyé{compte.envoye > 1 ? 's' : ''}
            {compte.ignore ? `, ${compte.ignore} passé${compte.ignore > 1 ? 's' : ''}` : ''}.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="px-4 pt-4">
          <SectionTitle>Destinataires</SectionTitle>
        </div>
        <ul className="pb-1">
          {donnees.envois
            .slice()
            .sort((a, b) => ['a_envoyer', 'envoye', 'ignore', 'bloque'].indexOf(a.etat) - ['a_envoyer', 'envoye', 'ignore', 'bloque'].indexOf(b.etat))
            .map((e) => {
              const c = donnees.contacts.get(e.contactId)
              return (
                <li key={e.id} className="flex items-center gap-2 px-4 py-2 text-sm [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
                  <Link to={`/contacts/${e.contactId}`} className="min-w-0 flex-1 truncate font-semibold">
                    {c ? nomAffiche(c) : 'Contact supprimé'}
                  </Link>
                  {e.etat === 'bloque' ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-suivi-rouge">
                      <ShieldAlert className="size-3.5" aria-hidden /> {e.raison ? LIBELLE_BLOCAGE[e.raison] : 'Bloqué'}
                    </span>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${e.etat === 'envoye' ? 'bg-suivi-vert/12 text-suivi-vert' : 'bg-surface-2 text-doux'}`}>{LIBELLE_ETAT[e.etat]}</span>
                  )}
                </li>
              )
            })}
        </ul>
      </Card>
    </div>
  )
}
