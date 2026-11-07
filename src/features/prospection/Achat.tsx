import { BadgeEuro, Calculator, Check, Handshake, Plus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useDroitsParDefaut } from '@/app/activite'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Saisie, Zone } from '@/components/ui/Champ'
import { SaisieNombre } from '@/components/ui/SaisieNombre'
import { interactions } from '@/data/repositories/interactions'
import { pistes } from '@/data/repositories/pistes'
import type { Bien, Piste } from '@/data/types'
import {
  arrondiOffre,
  calculerAchat,
  cloreOffresOuvertes,
  ETATS_BIEN,
  HYPOTHESES_DEFAUT,
  hypothesesVides,
  LIBELLE_ETAT_OFFRE,
  offreEnCours,
  relanceOffre,
  rendement,
  reventeSuggeree,
  type HypothesesAchat,
  type Objectif,
  type Offre,
  type ResultatCalcul,
} from '@/domain/achat'
import { ajouterJours } from '@/domain/dates'
import { communePour, dernierAnnuel, serie, typePourBien } from '@/domain/marche'
import { euros, useMarche } from '@/features/marche/donnees'

const pct = (n: number) => `${n.toLocaleString('fr-BE', { maximumFractionDigits: 1 })} %`
const nouvelId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/** Choix « mandat » ou « achat » pour une piste (activité « les deux »). */
export function ChoixObjectif({ piste, objectif }: { piste: Piste; objectif: Objectif }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Objectif de la piste">
      {(
        [
          ['mandat', 'Obtenir le mandat'],
          ['achat', 'Acheter le bien'],
        ] as const
      ).map(([code, libelle]) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={objectif === code}
          onClick={() => pistes.modifier(piste.id, { objectif: code })}
          className={`h-10 rounded-xl text-[13px] font-bold transition ${objectif === code ? 'bg-surface text-primaire-texte shadow-carte' : 'text-doux'}`}
        >
          {libelle}
        </button>
      ))}
    </div>
  )
}

/** Prix de revente suggéré : haut de fourchette Statbel de la commune pour ce type de bien. */
function useReventeSuggeree(bien: Bien): number | null {
  const d = useMarche()
  if (!d) return null
  const commune = communePour(d, bien.adresse)
  const type = typePourBien(bien.type, bien.facades) ?? 'maisons'
  if (!commune) return null
  const p = dernierAnnuel(serie(d, commune, type)) ?? dernierAnnuel(serie(d, commune, 'maisons'))
  return reventeSuggeree(p ? { mediane: p.mediane, p75: p.p75 } : null)
}

function Ligne({ libelle, valeur, fort, signe }: { libelle: string; valeur: number; fort?: boolean; signe?: '+' | '−' }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${fort ? 'border-t border-bord pt-2 font-extrabold' : ''}`}>
      <span className={fort ? '' : 'text-doux'}>{libelle}</span>
      <span className="tabular-nums">
        {signe && <span className="text-doux">{signe} </span>}
        {euros(Math.round(valeur))}
      </span>
    </div>
  )
}

function Hypothese({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-doux">{libelle}</span>
      {children}
    </label>
  )
}

/** Calculette « prix maximum » : combien payer ce bien pour garder la marge visée. */
export function Calculette({ piste, bien }: { piste: Piste; bien: Bien }) {
  const droitsDefaut = useDroitsParDefaut()
  const suggestion = useReventeSuggeree(bien)
  const [details, setDetails] = useState(false)
  const h: HypothesesAchat = { ...hypothesesVides(), ...piste.calcul }
  const modifier = (champ: keyof HypothesesAchat) => (n: number | null) => void pistes.modifier(piste.id, { calcul: { ...h, [champ]: n } })
  const commission = piste.apporteur?.commission ?? 0
  const donnees = { surface: bien.surfaceHabitable ?? null, etat: bien.etat ?? null, prixDemande: piste.prix, commissionApporteur: commission, droitsParDefaut: droitsDefaut ?? undefined }
  const r: ResultatCalcul | null = calculerAchat(h, donnees)
  const etat = ETATS_BIEN.find((e) => e.code === bien.etat)
  const manque = [!bien.surfaceHabitable && 'la surface habitable', !bien.etat && 'l’état'].filter(Boolean)
  const loyer = bien.loyersMensuels ?? 0
  const rendMax = r && loyer ? rendement(r.prixMax, loyer, bien.chargesAnnuelles ?? 0, r.valeurs) : null
  const rendDemande = r && loyer && piste.prix ? rendement(piste.prix, loyer, bien.chargesAnnuelles ?? 0, r.valeurs) : null

  return (
    <Card>
      <SectionTitle action={<Calculator className="size-5 text-primaire-texte" aria-hidden />}>Prix d’achat maximum</SectionTitle>

      {r ? (
        <div className="rounded-2xl bg-primaire-doux p-4">
          <div className="text-xs font-bold text-primaire-texte">Offre maximum pour {pct(r.valeurs.margePct)} de marge</div>
          <div className="text-3xl font-extrabold tracking-tight tabular-nums">{euros(arrondiOffre(r.prixMax))}</div>
          {r.auPrixDemande && piste.prix && (
            <p className={`mt-1 text-sm font-semibold ${piste.prix > arrondiOffre(r.prixMax) ? 'text-suivi-rouge' : 'text-suivi-vert'}`}>
              Prix demandé {euros(piste.prix)} :{' '}
              {piste.prix > arrondiOffre(r.prixMax)
                ? `${euros(piste.prix - arrondiOffre(r.prixMax))} au-dessus. À ce prix, marge ${euros(Math.round(r.auPrixDemande.marge))} (${pct(r.auPrixDemande.margePct)}).`
                : `dans votre budget. Marge ${euros(Math.round(r.auPrixDemande.marge))} (${pct(r.auPrixDemande.margePct)}).`}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm text-doux">Indiquez le prix de revente estimé après travaux : le prix maximum s’affiche aussitôt.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Hypothese libelle="Revente estimée après travaux">
            <SaisieNombre label="Prix de revente estimé" suffixe="€" valeur={h.revente} enregistrer={modifier('revente')} />
          </Hypothese>
          {suggestion && h.revente !== suggestion && (
            <button type="button" onClick={() => modifier('revente')(suggestion)} className="mt-1 text-left text-xs font-bold text-primaire-texte">
              Utiliser {euros(suggestion)} : haut de fourchette des ventes de la commune (Statbel)
            </button>
          )}
        </div>
        <Hypothese libelle={`Travaux au m²${etat ? ` (${etat.libelle.toLowerCase()} : ${etat.travauxM2} €)` : ''}`}>
          <SaisieNombre label="Travaux au mètre carré" suffixe="€" placeholder={etat ? String(etat.travauxM2) : undefined} valeur={h.travauxM2} enregistrer={modifier('travauxM2')} />
        </Hypothese>
        <Hypothese libelle="ou travaux au forfait">
          <SaisieNombre label="Travaux au forfait" suffixe="€" valeur={h.travauxForfait} enregistrer={modifier('travauxForfait')} />
        </Hypothese>
        <Hypothese libelle="Marge visée (sur la revente)">
          <SaisieNombre label="Marge visée" suffixe="%" placeholder={String(HYPOTHESES_DEFAUT.margePct)} valeur={h.margePct} enregistrer={modifier('margePct')} />
        </Hypothese>
        <Hypothese libelle="Durée avant revente">
          <SaisieNombre label="Durée avant revente en mois" suffixe="mois" placeholder={String(HYPOTHESES_DEFAUT.portageMois)} valeur={h.portageMois} enregistrer={modifier('portageMois')} />
        </Hypothese>
      </div>
      {manque.length > 0 && (
        <p className="mt-2 text-xs text-doux">
          Pour estimer les travaux, ajoutez {manque.join(' et ')} sur la{' '}
          <Link to={`/biens/${bien.id}`} className="font-bold text-primaire-texte">
            fiche du bien
          </Link>
          {' '}(ou un montant au forfait).
        </p>
      )}

      <button type="button" onClick={() => setDetails((d) => !d)} className="mt-3 text-sm font-bold text-primaire-texte" aria-expanded={details}>
        {details ? 'Masquer le détail' : 'Détail du calcul et autres hypothèses'}
      </button>
      {details && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Hypothese libelle="Droits d’enregistrement">
              <SaisieNombre label="Droits d’enregistrement" suffixe="%" placeholder={String(droitsDefaut ?? HYPOTHESES_DEFAUT.droitsPct).replace('.', ',')} valeur={h.droitsPct} enregistrer={modifier('droitsPct')} />
            </Hypothese>
            <Hypothese libelle="Notaire et frais d’acte">
              <SaisieNombre label="Notaire et frais d’acte" suffixe="%" placeholder={String(HYPOTHESES_DEFAUT.notairePct).replace('.', ',')} valeur={h.notairePct} enregistrer={modifier('notairePct')} />
            </Hypothese>
            <Hypothese libelle="Frais de revente">
              <SaisieNombre label="Frais de revente" suffixe="%" placeholder={String(HYPOTHESES_DEFAUT.fraisReventePct)} valeur={h.fraisReventePct} enregistrer={modifier('fraisReventePct')} />
            </Hypothese>
            <Hypothese libelle="Coût de l’argent par an">
              <SaisieNombre label="Coût de l’argent par an" suffixe="%" placeholder={String(HYPOTHESES_DEFAUT.tauxAnnuelPct)} valeur={h.tauxAnnuelPct} enregistrer={modifier('tauxAnnuelPct')} />
            </Hypothese>
          </div>
          {r && (
            <div className="rounded-2xl bg-surface-2 p-3 text-sm">
              <div className="mb-1 text-xs font-bold text-doux">Au prix maximum</div>
              <Ligne libelle="Achat" valeur={r.auMax.prixAchat} />
              <Ligne libelle={`Droits et notaire (${pct(r.valeurs.droitsPct + r.valeurs.notairePct)})`} valeur={r.auMax.frais} signe="+" />
              <Ligne libelle="Travaux" valeur={r.auMax.travaux} signe="+" />
              <Ligne libelle={`Portage (${r.valeurs.portageMois} mois à ${pct(r.valeurs.tauxAnnuelPct)})`} valeur={r.auMax.portage} signe="+" />
              {r.auMax.commission > 0 && <Ligne libelle="Commission de l’apporteur" valeur={r.auMax.commission} signe="+" />}
              <Ligne libelle="Coût total" valeur={r.auMax.coutTotal} fort />
              <Ligne libelle="Revente" valeur={r.auMax.revente} />
              <Ligne libelle={`Frais de revente (${pct(r.valeurs.fraisReventePct)})`} valeur={r.auMax.fraisRevente} signe="−" />
              <Ligne libelle="Marge" valeur={r.auMax.marge} fort />
            </div>
          )}
          <p className="text-xs text-doux">
            Droits : 12,5 % en Wallonie, taux réduit pour les marchands de biens enregistrés (réglez votre taux dans Paramètres → Activité). Ce calcul est une aide :
            faites valider les frais par votre notaire.
          </p>
        </div>
      )}

      {rendMax && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm">
          <div className="font-bold">En location ({euros(loyer)} par mois)</div>
          <div className="mt-1 flex justify-between">
            <span className="text-doux">Au prix maximum</span>
            <span className="font-bold tabular-nums">
              {pct(rendMax.brutPct)} brut · {pct(rendMax.netPct)} net
            </span>
          </div>
          {rendDemande && (
            <div className="flex justify-between">
              <span className="text-doux">Au prix demandé</span>
              <span className="font-bold tabular-nums">
                {pct(rendDemande.brutPct)} brut · {pct(rendDemande.netPct)} net
              </span>
            </div>
          )}
          <p className="mt-1 text-xs text-doux">Sur le coût total : achat, droits, notaire et travaux.</p>
        </div>
      )}
    </Card>
  )
}

/** Apporteur d'affaires et sa commission (comptée dans la calculette). */
export function Apporteur({ piste }: { piste: Piste }) {
  const a = piste.apporteur ?? { nom: '', commission: null }
  const [nom, setNom] = useState(a.nom)
  return (
    <Card>
      <SectionTitle action={<Handshake className="size-5 text-primaire-texte" aria-hidden />}>Apporteur d’affaires</SectionTitle>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Saisie placeholder="Nom" aria-label="Nom de l’apporteur" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={() => nom !== a.nom && pistes.modifier(piste.id, { apporteur: { ...a, nom } })} />
        <SaisieNombre label="Commission de l’apporteur" suffixe="€" placeholder="Commission" valeur={a.commission} enregistrer={(commission) => pistes.modifier(piste.id, { apporteur: { ...a, nom, commission } })} />
      </div>
    </Card>
  )
}

/** Offres d'achat : faire une offre, noter la réponse du vendeur, puis compromis et acte. */
export function Offres({ piste, bien }: { piste: Piste; bien: Bien }) {
  const droitsDefaut = useDroitsParDefaut()
  const liste = [...(piste.offres ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const ouverte = offreEnCours(piste.offres)
  const acceptee = liste.find((o) => o.etat === 'acceptee')
  const [form, setForm] = useState(false)
  const [contre, setContre] = useState<string | null>(null)
  const r = calculerAchat({ ...hypothesesVides(), ...piste.calcul }, {
    surface: bien.surfaceHabitable ?? null,
    etat: bien.etat ?? null,
    prixDemande: piste.prix,
    commissionApporteur: piste.apporteur?.commission ?? 0,
    droitsParDefaut: droitsDefaut ?? undefined,
  })
  const enregistrerOffres = (offres: Offre[]) => pistes.modifier(piste.id, { offres })
  const noter = (resultat: 'offre_faite' | 'offre_refusee' | 'compromis' | 'acte' | 'note', commentaire: string, relance?: Date | null) =>
    interactions.enregistrerResultat({ contactId: piste.contactId, pisteId: piste.id, type: 'note', resultat, commentaire, relance })

  const repondre = async (o: Offre, etat: Offre['etat'], contreOffre?: number) => {
    const maj = liste.map((x) => (x.id === o.id ? { ...x, etat, contreOffre: contreOffre ?? x.contreOffre } : x))
    await enregistrerOffres(etat === 'acceptee' ? cloreOffresOuvertes(maj, o.id) : maj)
    if (etat === 'refusee') await noter('offre_refusee', `Offre de ${euros(o.montant)} refusée`)
    if (etat === 'acceptee') await noter('note', `Offre de ${euros(o.montant)} acceptée : préparer le compromis`, ajouterJours(new Date(), 2))
    if (etat === 'contre_offre' && contreOffre) await noter('note', `Contre-offre du vendeur : ${euros(contreOffre)} (notre offre : ${euros(o.montant)})`, ajouterJours(new Date(), 2))
    setContre(null)
  }

  return (
    <Card>
      <SectionTitle action={<BadgeEuro className="size-5 text-primaire-texte" aria-hidden />}>Offres</SectionTitle>
      {liste.length === 0 && !form && <p className="text-sm text-doux">Aucune offre pour l’instant.</p>}
      <ol className="flex flex-col gap-2">
        {liste.map((o) => (
          <li key={o.id} className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-extrabold tabular-nums">{euros(o.montant)}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  o.etat === 'acceptee' ? 'bg-suivi-vert/15 text-suivi-vert' : o.etat === 'refusee' ? 'bg-suivi-rouge/12 text-suivi-rouge' : 'bg-suivi-orange/15 text-suivi-orange'
                }`}
              >
                {LIBELLE_ETAT_OFFRE[o.etat]}
                {o.etat === 'contre_offre' && o.contreOffre ? ` : ${euros(o.contreOffre)}` : ''}
              </span>
            </div>
            <div className="text-xs text-doux">
              Le {new Date(o.date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}
              {o.valableJusquau && ` · valable jusqu’au ${new Date(`${o.valableJusquau}T12:00`).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}`}
            </div>
            {o.note && <p className="mt-1">{o.note}</p>}
            {o.id === ouverte?.id && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => repondre(o, 'acceptee')} className="presse h-9 rounded-full bg-suivi-vert/15 px-3 text-xs font-bold text-suivi-vert">
                  <Check className="mr-1 inline size-3.5" aria-hidden />
                  Acceptée
                </button>
                <button type="button" onClick={() => setContre('')} className="presse h-9 rounded-full bg-surface px-3 text-xs font-bold">
                  Contre-offre
                </button>
                <button type="button" onClick={() => repondre(o, 'refusee')} className="presse h-9 rounded-full bg-suivi-rouge/10 px-3 text-xs font-bold text-suivi-rouge">
                  <X className="mr-1 inline size-3.5" aria-hidden />
                  Refusée
                </button>
              </div>
            )}
            {o.id === ouverte?.id && contre !== null && (
              <div className="mt-2 flex gap-2">
                <Saisie inputMode="numeric" autoFocus placeholder="Prix demandé en retour (€)" aria-label="Contre-offre du vendeur" value={contre} onChange={(e) => setContre(e.target.value)} className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    const n = Number(contre.replace(/[^\d]/g, ''))
                    if (n) void repondre(o, 'contre_offre', n)
                  }}
                  className={`${classesBouton('primaire')} h-12 rounded-2xl`}
                >
                  OK
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {acceptee && piste.statut !== 'gagne' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={piste.statut === 'compromis'}
            onClick={() => noter('compromis', `Compromis signé à ${euros(acceptee.montant)}`)}
            className={`${classesBouton(piste.statut === 'compromis' ? 'fantome' : 'primaire')} h-12 rounded-2xl text-xs`}
          >
            {piste.statut === 'compromis' ? 'Compromis signé ✓' : 'Compromis signé'}
          </button>
          <button type="button" onClick={() => noter('acte', `Acte signé : bien acheté ${euros(acceptee.montant)}`, null)} className={`${classesBouton('secondaire')} h-12 rounded-2xl text-xs`}>
            Acte signé
          </button>
        </div>
      )}

      {form ? (
        <FormulaireOffre
          suggestion={r ? arrondiOffre(r.prixMax) : null}
          annuler={() => setForm(false)}
          valider={async (o) => {
            await enregistrerOffres([...cloreOffresOuvertes(piste.offres ?? []), o])
            await noter(
              'offre_faite',
              `Offre de ${euros(o.montant)}${o.valableJusquau ? `, valable jusqu’au ${new Date(`${o.valableJusquau}T12:00`).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}` : ''}${o.note ? ` — ${o.note}` : ''}`,
              relanceOffre(o, new Date()),
            )
            setForm(false)
          }}
        />
      ) : (
        !acceptee &&
        piste.statut !== 'gagne' && (
          <button type="button" onClick={() => setForm(true)} className={`${classesBouton(ouverte ? 'secondaire' : 'primaire')} mt-3 h-12 w-full rounded-2xl`}>
            <Plus className="size-4" aria-hidden /> {ouverte ? 'Nouvelle offre' : 'Faire une offre'}
          </button>
        )
      )}
    </Card>
  )
}

function FormulaireOffre({ suggestion, valider, annuler }: { suggestion: number | null; valider: (o: Offre) => void; annuler: () => void }) {
  const [montant, setMontant] = useState(suggestion ? String(suggestion) : '')
  const dans7 = ajouterJours(new Date(), 7)
  const [jusquau, setJusquau] = useState(`${dans7.getFullYear()}-${String(dans7.getMonth() + 1).padStart(2, '0')}-${String(dans7.getDate()).padStart(2, '0')}`)
  const [note, setNote] = useState('')
  const n = Number(montant.replace(/[^\d]/g, ''))
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-doux">Montant offert (€){suggestion ? ` · votre maximum : ${euros(suggestion)}` : ''}</span>
        <Saisie inputMode="numeric" autoFocus value={montant} onChange={(e) => setMontant(e.target.value)} aria-label="Montant offert" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-doux">Valable jusqu’au</span>
        <Saisie type="date" value={jusquau} onChange={(e) => setJusquau(e.target.value)} aria-label="Offre valable jusqu’au" />
      </label>
      <Zone rows={2} placeholder="Conditions : sous réserve de financement, état du sol…" aria-label="Conditions de l’offre" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" onClick={annuler} className={`${classesBouton('fantome')} h-12 flex-1 rounded-2xl`}>
          Annuler
        </button>
        <button
          type="button"
          disabled={!n}
          onClick={() => valider({ id: nouvelId(), date: new Date().toISOString(), montant: n, valableJusquau: jusquau || null, etat: 'en_attente', contreOffre: null, note: note.trim() })}
          className={`${classesBouton('primaire')} h-12 flex-[2] rounded-2xl`}
        >
          Enregistrer l’offre
        </button>
      </div>
    </div>
  )
}
