import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useBlocker, useLocation, useNavigate, useParams } from 'react-router'
import { RelanceChoix } from '@/components/RelanceChoix'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Liste, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { adresseVide, contacts, contactVide, type DonneesContact } from '@/data/repositories/contacts'
import { evenements } from '@/data/repositories/evenements'
import type { PreRemplissageContact } from '@/features/agenda/AEncoder'
import { SOURCES_CONTACT, STATUTS_CONTACT, type Adresse, type Civilite, type Contact, type SourceContact, type StatutContact } from '@/data/types'
import { CODES_POSTAUX, cpPourLocalite, localitesPourCp } from '@/domain/adresse'
import { depuisDateLocale, versDateLocale } from '@/domain/dates'
import { champsModifies } from '@/domain/diff'
import { LIBELLE_TEMPERATURE, type Temperature } from '@/domain/relance'
import { formaterTelephone, normaliserTelephone, type Canal } from '@/domain/telephone'
import { FichesSimilaires, useFichesSimilaires } from './FichesSimilaires'
import { confirmer } from '@/components/ui/Confirmation'

const CANAUX: { code: Canal; libelle: string }[] = [
  { code: 'appel', libelle: 'Appel' },
  { code: 'whatsapp', libelle: 'WhatsApp' },
  { code: 'sms', libelle: 'SMS' },
  { code: 'email', libelle: 'Email' },
]

const LOCALITES = [...new Set(CODES_POSTAUX.map(([, v]) => v))].sort((a, b) => a.localeCompare(b, 'fr'))

const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

function versFormulaire(c: Contact): DonneesContact {
  const donnees: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(c)) {
    if (cle.startsWith('_') || ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].includes(cle)) continue
    donnees[cle] = valeur
  }
  return donnees as DonneesContact
}

/** Nettoie la saisie avant enregistrement (lignes vides retirées, numéros reformatés). */
function nettoyer(d: DonneesContact): DonneesContact {
  return {
    ...d,
    prenom: d.prenom.trim(),
    nom: d.nom.trim(),
    societe: d.societe.trim(),
    telephones: d.telephones
      .filter((t) => t.numero.trim())
      .map((t) => ({ ...t, numero: normaliserTelephone(t.numero) ? formaterTelephone(t.numero) : t.numero.trim(), libelle: t.libelle?.trim() || undefined })),
    emails: d.emails.map((e) => e.trim()).filter(Boolean),
    adresse: d.adresse && Object.values(d.adresse).some((v) => v.trim()) ? d.adresse : null,
    tags: d.tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
  }
}

export default function ContactFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  // Estimation reçue par Google Agenda : formulaire pré-rempli, rendez-vous rattaché à l'enregistrement.
  const estimation = (useLocation().state as { estimation?: PreRemplissageContact } | null)?.estimation
  const existant = useLiveQuery(() => (id ? contacts.get(id) : undefined), [id], null)
  const [d, setD] = useState<DonneesContact | null>(id ? null : { ...contactVide(), telephones: [{ numero: '' }], ...estimation?.contact })
  const initial = useRef<string | null>(id ? null : JSON.stringify(d))
  const enregistre = useRef(false)
  const [enregistrement, setEnregistrement] = useState(false)

  useEffect(() => {
    if (id && existant && !d) {
      const f = versFormulaire(existant)
      initial.current = JSON.stringify(f)
      setD(f)
    }
  }, [id, existant, d])

  const modifie = d !== null && initial.current !== null && JSON.stringify(d) !== initial.current

  // Avertissement avant de quitter un formulaire modifié (navigation dans l'appli ou fermeture de l'onglet).
  const blocage = useBlocker(({ currentLocation, nextLocation }) => modifie && !enregistre.current && currentLocation.pathname !== nextLocation.pathname)
  const questionEnCours = useRef(false)
  useEffect(() => {
    if (blocage.state !== 'blocked' || questionEnCours.current) return
    questionEnCours.current = true
    void confirmer({
      titre: 'Quitter sans enregistrer ?',
      message: 'Les modifications de cette fiche seront perdues.',
      confirmer: 'Quitter',
      annuler: 'Continuer la saisie',
      danger: true,
    }).then((ok) => {
      questionEnCours.current = false
      if (ok) blocage.proceed()
      else blocage.reset()
    })
  }, [blocage])
  useEffect(() => {
    if (!modifie) return
    const avant = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avant)
    return () => window.removeEventListener('beforeunload', avant)
  }, [modifie])

  const similaires = useFichesSimilaires(d, id)

  if (!d) {
    if (id && existant === undefined)
      return (
        <div className="py-16 text-center">
          <p className="text-doux">Ce contact n’existe pas (ou plus sur cet appareil).</p>
          <button type="button" onClick={() => navigate('/contacts')} className="mt-4 font-semibold text-primaire-texte underline">
            Retour aux contacts
          </button>
        </div>
      )
    return null
  }
  const maj = (patch: Partial<DonneesContact>) => setD({ ...d, ...patch })
  const adresse = d.adresse ?? adresseVide()
  const majAdresse = (patch: Partial<Adresse>) => maj({ adresse: { ...adresse, ...patch } })

  const changerCp = (cp: string) => {
    const localites = localitesPourCp(cp)
    majAdresse({ cp, ...(localites.length === 1 && !adresse.ville.trim() ? { ville: localites[0] } : {}) })
  }
  const changerLocalite = (ville: string) => {
    const cp = cpPourLocalite(ville)
    majAdresse({ ville, ...(cp && !adresse.cp.trim() ? { cp } : {}) })
  }

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault()
    if (enregistrement) return
    setEnregistrement(true)
    try {
      const propre = nettoyer(d)
      // En modification, on n'envoie que ce que l'utilisateur a changé dans le formulaire :
      // les champs modifiés entre-temps par un collègue ne sont pas écrasés.
      const fiche = id
        ? await contacts.modifier(id, champsModifies(nettoyer(JSON.parse(initial.current!) as DonneesContact), propre))
        : await contacts.creer(propre)
      if (!id && estimation) await evenements.modifier(estimation.evenementId, { contactId: fiche.id, aEncoder: false })
      enregistre.current = true
      navigate(`/contacts/${fiche.id}`, { replace: true })
    } finally {
      setEnregistrement(false)
    }
  }

  const basculerStatut = (s: StatutContact) => maj({ statuts: d.statuts.includes(s) ? d.statuts.filter((x) => x !== s) : [...d.statuts, s] })

  return (
    <form noValidate onSubmit={enregistrer} className="flex flex-col gap-4 pb-28 lg:pb-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="presse grid size-11 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord"
          aria-label="Retour"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{id ? 'Modifier le contact' : 'Nouveau contact'}</h1>
          <p className="text-xs font-medium text-doux">Aucun champ obligatoire : complétez ce que vous savez.</p>
        </div>
      </div>

      {/* Le téléphone d'abord : c'est souvent la seule information lue sur une affiche. */}
      <Card>
        <SectionTitle>Téléphone</SectionTitle>
        <div className="flex flex-col gap-2">
          {d.telephones.map((t, i) => {
            const invalide = t.numero.trim() && !normaliserTelephone(t.numero)
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Saisie
                    type="tel"
                    inputMode="tel"
                    placeholder="0476 12 34 56"
                    value={t.numero}
                    autoFocus={!id && i === 0}
                    aria-label={`Téléphone ${i + 1}`}
                    onChange={(e) => maj({ telephones: d.telephones.map((x, j) => (j === i ? { ...x, numero: e.target.value } : x)) })}
                    className="flex-[2]"
                  />
                  <Saisie
                    placeholder="GSM, fixe…"
                    value={t.libelle ?? ''}
                    aria-label={`Libellé du téléphone ${i + 1}`}
                    onChange={(e) => maj({ telephones: d.telephones.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)) })}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => maj({ telephones: d.telephones.filter((_, j) => j !== i) })}
                    className="grid size-12 shrink-0 place-items-center rounded-2xl text-doux"
                    aria-label="Retirer ce numéro"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
                {invalide && <span className="text-xs font-semibold text-suivi-orange">Numéro non reconnu — vérifiez la saisie.</span>}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => maj({ telephones: [...d.telephones, { numero: '' }] })}
            className="flex h-11 items-center gap-2 self-start text-sm font-bold text-primaire-texte"
          >
            <Plus className="size-4" /> Ajouter un numéro
          </button>
        </div>
      </Card>

      <FichesSimilaires candidats={similaires} />

      <Card>
        <SectionTitle>Identité</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ libelle="Prénom">
            <Saisie value={d.prenom} onChange={(e) => maj({ prenom: e.target.value })} autoComplete="off" autoCapitalize="words" />
          </Champ>
          <Champ libelle="Nom">
            <Saisie value={d.nom} onChange={(e) => maj({ nom: e.target.value })} autoComplete="off" autoCapitalize="words" />
          </Champ>
          <Champ libelle="Civilité">
            <Liste value={d.civilite} onChange={(e) => maj({ civilite: e.target.value as Civilite })}>
              <option value="">—</option>
              <option>M.</option>
              <option>Mme</option>
              <option>M. et Mme</option>
            </Liste>
          </Champ>
          <Champ libelle="Société">
            <Saisie value={d.societe} onChange={(e) => maj({ societe: e.target.value })} autoComplete="off" />
          </Champ>
          <Champ libelle="Date de naissance">
            <Saisie type="date" value={d.dateNaissance ?? ''} onChange={(e) => maj({ dateNaissance: e.target.value || null })} />
          </Champ>
        </div>
      </Card>

      <Card>
        <SectionTitle>Email</SectionTitle>
        <div className="flex flex-col gap-2">
          {[...d.emails, ''].map((e, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Saisie
                type="text"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={i === 0 ? 'nom@exemple.be' : 'Autre email (facultatif)'}
                value={e}
                aria-label={`Email ${i + 1}`}
                onChange={(ev) => {
                  const liste = [...d.emails]
                  liste[i] = ev.target.value
                  maj({ emails: liste.filter((x, j) => x || j < liste.length - 1) })
                }}
              />
              {e.trim() && !emailValide(e) && <span className="text-xs font-semibold text-suivi-orange">Adresse email incomplète — vérifiez la saisie.</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Adresse</SectionTitle>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-6 sm:col-span-4">
            <Champ libelle="Rue">
              <Saisie value={adresse.rue} onChange={(e) => majAdresse({ rue: e.target.value })} autoComplete="off" />
            </Champ>
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Champ libelle="N°">
              <Saisie value={adresse.numero} onChange={(e) => majAdresse({ numero: e.target.value })} />
            </Champ>
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Champ libelle="Boîte">
              <Saisie value={adresse.boite} onChange={(e) => majAdresse({ boite: e.target.value })} />
            </Champ>
          </div>
          <div className="col-span-2">
            <Champ libelle="Code postal">
              <Saisie inputMode="numeric" maxLength={4} value={adresse.cp} onChange={(e) => changerCp(e.target.value)} />
            </Champ>
          </div>
          <div className="col-span-4">
            <Champ libelle="Localité">
              <Saisie
                list="localites"
                value={adresse.ville}
                onChange={(e) => changerLocalite(e.target.value)}
                autoComplete="off"
                placeholder={localitesPourCp(adresse.cp).join(', ') || undefined}
              />
            </Champ>
          </div>
        </div>
        <datalist id="localites">
          {(localitesPourCp(adresse.cp).length ? localitesPourCp(adresse.cp) : LOCALITES).map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        {id && <p className="mt-2 text-xs text-doux">En cas de déménagement, l’ancienne adresse est conservée dans l’historique.</p>}
      </Card>

      <Card>
        <SectionTitle>Relances</SectionTitle>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-doux">Prochaine relance</div>
            <RelanceChoix valeur={d.prochaineRelanceAt} onChange={(iso) => maj({ prochaineRelanceAt: iso })} />
          </div>
          <Champ libelle="Dernier contact">
            <div className="flex gap-2">
              <Saisie
                type="date"
                value={versDateLocale(d.dernierContactAt)}
                max={versDateLocale(new Date().toISOString())}
                onChange={(e) => maj({ dernierContactAt: depuisDateLocale(e.target.value, 12) })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => maj({ dernierContactAt: new Date().toISOString() })}
                className={`${classesBouton('fantome')} h-12 rounded-2xl`}
              >
                Aujourd’hui
              </button>
            </div>
          </Champ>
        </div>
      </Card>

      <Card>
        <SectionTitle>Profil</SectionTitle>
        <div className="flex flex-col gap-4">
          <Champ libelle="Origine du contact" aide="D’où vient ce numéro ? (utile pour le suivi et le RGPD)">
            <Liste value={d.source ?? ''} onChange={(e) => maj({ source: (e.target.value || null) as SourceContact | null })}>
              <option value="">—</option>
              {SOURCES_CONTACT.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.libelle}
                </option>
              ))}
            </Liste>
          </Champ>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-doux">Statuts</div>
            <div className="flex flex-wrap gap-2">
              {STATUTS_CONTACT.map((s) => (
                <Puce key={s.code} actif={d.statuts.includes(s.code)} onClick={() => basculerStatut(s.code)}>
                  {s.libelle}
                </Puce>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-doux">Température</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LIBELLE_TEMPERATURE) as Temperature[]).map((t) => (
                <Puce key={t} actif={d.temperature === t} onClick={() => maj({ temperature: d.temperature === t ? null : t })}>
                  {LIBELLE_TEMPERATURE[t]}
                </Puce>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-doux">Canal préféré</div>
            <div className="flex flex-wrap gap-2">
              {CANAUX.map((c) => (
                <Puce key={c.code} actif={d.canalPrefere === c.code} onClick={() => maj({ canalPrefere: d.canalPrefere === c.code ? null : c.code })}>
                  {c.libelle}
                </Puce>
              ))}
            </div>
          </div>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" checked={d.nePasContacter} onChange={(e) => maj({ nePasContacter: e.target.checked })} className="size-5 accent-[var(--primaire)]" />
            <span className="text-sm font-semibold">Ne pas contacter</span>
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle>Notes</SectionTitle>
        <div className="flex flex-col gap-3">
          <Champ libelle="Tags" aide="Séparés par des virgules : investisseur, notaire…">
            <Saisie value={d.tags.join(', ')} onChange={(e) => maj({ tags: e.target.value.split(',').map((t) => t.trimStart()) })} />
          </Champ>
          <Champ libelle="Notes">
            <Zone value={d.notes} onChange={(e) => maj({ notes: e.target.value })} />
          </Champ>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-fond via-fond/95 to-fond/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 lg:static lg:bg-none lg:p-0">
        {similaires.length > 0 && (
          <a
            href="#fiches-similaires"
            className="mb-2 flex items-center justify-center gap-2 rounded-2xl bg-surface py-2.5 text-sm font-bold text-suivi-orange shadow-carte ring-1 ring-suivi-orange/30 lg:hidden"
          >
            <AlertTriangle className="size-4" aria-hidden /> {similaires.length} fiche{similaires.length > 1 ? 's' : ''} similaire{similaires.length > 1 ? 's' : ''} — voir
          </a>
        )}
        <button type="submit" disabled={enregistrement} className={`${classesBouton('primaire', 'lg')} w-full`}>
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
