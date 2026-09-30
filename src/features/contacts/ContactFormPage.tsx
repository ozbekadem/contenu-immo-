import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Champ, Liste, Puce, Saisie, Zone } from '@/components/ui/Champ'
import { adresseVide, contacts, contactVide, type DonneesContact } from '@/data/repositories/contacts'
import { STATUTS_CONTACT, type Civilite, type Contact, type StatutContact } from '@/data/types'
import { LIBELLE_TEMPERATURE, type Temperature } from '@/domain/relance'
import { formaterTelephone, normaliserTelephone, type Canal } from '@/domain/telephone'
import { nomAffiche } from './affichage'

const CANAUX: { code: Canal; libelle: string }[] = [
  { code: 'appel', libelle: 'Appel' },
  { code: 'whatsapp', libelle: 'WhatsApp' },
  { code: 'sms', libelle: 'SMS' },
  { code: 'email', libelle: 'Email' },
]

function versFormulaire(c: Contact): DonneesContact {
  const { id, createdAt, updatedAt, createdBy, updatedBy, _ts, _demo, _telNorm, _recherche, _tri, ...donnees } = c
  void [id, createdAt, updatedAt, createdBy, updatedBy, _ts, _demo, _telNorm, _recherche, _tri]
  return donnees
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
    tags: d.tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
  }
}

/** Contacts existants partageant un des numéros saisis (signalement uniquement, jamais de fusion). */
function useDoublons(numeros: string[], exclureId?: string): Contact[] {
  const [doublons, setDoublons] = useState<Contact[]>([])
  const cle = numeros.map(normaliserTelephone).filter(Boolean).join('|')
  useEffect(() => {
    let actif = true
    const t = setTimeout(async () => {
      const trouves = cle ? await contacts.trouverParTelephones(cle.split('|'), exclureId) : []
      if (actif) setDoublons(trouves)
    }, 150)
    return () => {
      actif = false
      clearTimeout(t)
    }
  }, [cle, exclureId])
  return doublons
}

export default function ContactFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existant = useLiveQuery(() => (id ? contacts.get(id) : undefined), [id], null)
  const [d, setD] = useState<DonneesContact | null>(id ? null : { ...contactVide(), telephones: [{ numero: '' }] })
  const [enregistrement, setEnregistrement] = useState(false)

  useEffect(() => {
    if (id && existant && !d) setD(versFormulaire(existant))
  }, [id, existant, d])

  const doublons = useDoublons(d?.telephones.map((t) => t.numero) ?? [], id)

  if (!d) return null
  const maj = (patch: Partial<DonneesContact>) => setD({ ...d, ...patch })
  const adresse = d.adresse ?? adresseVide()

  const valide = !!(d.prenom.trim() || d.nom.trim() || d.societe.trim())

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault()
    if (!valide || enregistrement) return
    setEnregistrement(true)
    try {
      const propre = nettoyer(d)
      const fiche = id ? await contacts.modifier(id, propre) : await contacts.creer(propre)
      navigate(`/contacts/${fiche.id}`, { replace: true })
    } finally {
      setEnregistrement(false)
    }
  }

  const basculerStatut = (s: StatutContact) =>
    maj({ statuts: d.statuts.includes(s) ? d.statuts.filter((x) => x !== s) : [...d.statuts, s] })

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-4 pb-24 lg:pb-0">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight">{id ? 'Modifier le contact' : 'Nouveau contact'}</h1>
      </div>

      <Card>
        <SectionTitle>Identité</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ libelle="Civilité">
            <Liste value={d.civilite} onChange={(e) => maj({ civilite: e.target.value as Civilite })}>
              <option value="">—</option>
              <option>M.</option>
              <option>Mme</option>
              <option>M. et Mme</option>
            </Liste>
          </Champ>
          <Champ libelle="Société">
            <Saisie value={d.societe} onChange={(e) => maj({ societe: e.target.value })} autoComplete="organization" />
          </Champ>
          <Champ libelle="Prénom">
            <Saisie value={d.prenom} onChange={(e) => maj({ prenom: e.target.value })} autoComplete="given-name" autoCapitalize="words" />
          </Champ>
          <Champ libelle="Nom">
            <Saisie value={d.nom} onChange={(e) => maj({ nom: e.target.value })} autoComplete="family-name" autoCapitalize="words" />
          </Champ>
          <Champ libelle="Date de naissance">
            <Saisie type="date" value={d.dateNaissance ?? ''} onChange={(e) => maj({ dateNaissance: e.target.value || null })} />
          </Champ>
        </div>
        {!valide && <p className="mt-2 text-xs text-doux">Indiquez au moins un prénom, un nom ou une société.</p>}
      </Card>

      <Card>
        <SectionTitle>Téléphones</SectionTitle>
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
                    className="grid size-12 shrink-0 place-items-center rounded-xl text-doux"
                    aria-label="Retirer ce numéro"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
                {invalide && <span className="text-xs text-suivi-orange">Numéro non reconnu — vérifiez la saisie.</span>}
              </div>
            )
          })}
          <button type="button" onClick={() => maj({ telephones: [...d.telephones, { numero: '' }] })} className="flex h-11 items-center gap-2 self-start text-sm font-semibold">
            <Plus className="size-4" /> Ajouter un numéro
          </button>
        </div>

        {doublons.length > 0 && (
          <div role="alert" className="mt-3 rounded-xl border border-suivi-orange/40 bg-suivi-orange/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-bold text-suivi-orange">
              <AlertTriangle className="size-4" aria-hidden /> Doublon possible
            </div>
            <p className="mt-1">Ce numéro est déjà utilisé par :</p>
            <ul className="mt-1 space-y-1">
              {doublons.map((c) => (
                <li key={c.id}>
                  <Link to={`/contacts/${c.id}`} className="font-semibold underline">
                    {nomAffiche(c)}
                  </Link>
                  {c.adresse?.ville && <span className="text-doux"> — {c.adresse.ville}</span>}
                  {c.archivedAt && <span className="text-doux"> (archivé)</span>}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-doux">Vous pouvez tout de même enregistrer : rien n’est fusionné automatiquement.</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Email</SectionTitle>
        <div className="flex flex-col gap-2">
          {[...d.emails, ''].map((e, i) => (
            <Saisie
              key={i}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={i === 0 ? 'nom@exemple.be' : 'Autre email (facultatif)'}
              value={e}
              aria-label={`Email ${i + 1}`}
              onChange={(ev) => {
                const liste = [...d.emails]
                liste[i] = ev.target.value
                maj({ emails: liste.filter((x, j) => x || j < liste.length - 1) })
              }}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Adresse</SectionTitle>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-6 sm:col-span-4">
            <Champ libelle="Rue">
              <Saisie value={adresse.rue} onChange={(e) => maj({ adresse: { ...adresse, rue: e.target.value } })} autoComplete="address-line1" />
            </Champ>
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Champ libelle="N°">
              <Saisie value={adresse.numero} onChange={(e) => maj({ adresse: { ...adresse, numero: e.target.value } })} />
            </Champ>
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Champ libelle="Boîte">
              <Saisie value={adresse.boite} onChange={(e) => maj({ adresse: { ...adresse, boite: e.target.value } })} />
            </Champ>
          </div>
          <div className="col-span-2">
            <Champ libelle="Code postal">
              <Saisie inputMode="numeric" value={adresse.cp} onChange={(e) => maj({ adresse: { ...adresse, cp: e.target.value } })} autoComplete="postal-code" />
            </Champ>
          </div>
          <div className="col-span-4">
            <Champ libelle="Localité">
              <Saisie value={adresse.ville} onChange={(e) => maj({ adresse: { ...adresse, ville: e.target.value } })} autoComplete="address-level2" />
            </Champ>
          </div>
        </div>
        {id && <p className="mt-2 text-xs text-doux">En cas de déménagement, l’ancienne adresse est conservée dans l’historique.</p>}
      </Card>

      <Card>
        <SectionTitle>Suivi</SectionTitle>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-sm font-semibold">Statuts</div>
            <div className="flex flex-wrap gap-2">
              {STATUTS_CONTACT.map((s) => (
                <Puce key={s.code} actif={d.statuts.includes(s.code)} onClick={() => basculerStatut(s.code)}>
                  {s.libelle}
                </Puce>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold">Température</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LIBELLE_TEMPERATURE) as Temperature[]).map((t) => (
                <Puce key={t} actif={d.temperature === t} onClick={() => maj({ temperature: d.temperature === t ? null : t })}>
                  {LIBELLE_TEMPERATURE[t]}
                </Puce>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold">Canal préféré</div>
            <div className="flex flex-wrap gap-2">
              {CANAUX.map((c) => (
                <Puce key={c.code} actif={d.canalPrefere === c.code} onClick={() => maj({ canalPrefere: d.canalPrefere === c.code ? null : c.code })}>
                  {c.libelle}
                </Puce>
              ))}
            </div>
          </div>
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              checked={d.nePasContacter}
              onChange={(e) => maj({ nePasContacter: e.target.checked })}
              className="size-5 accent-suivi-rouge"
            />
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bord bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <button
          type="submit"
          disabled={!valide || enregistrement}
          className="h-14 w-full rounded-2xl bg-accent text-base font-extrabold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
