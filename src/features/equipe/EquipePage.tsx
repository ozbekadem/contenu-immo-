import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownRight, ArrowUpRight, ClipboardCheck, Copy, Minus, Table2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/app/auth'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Liste, Puce, Saisie } from '@/components/ui/Champ'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/data/db'
import { serveurConfigure } from '@/data/sync/supabase'
import { SOURCES_CONTACT, type Interaction, type Piste } from '@/data/types'
import { chiffres, parOrigine, parSemaine, periode, PERIODES, valeurPortefeuille, type Chiffres, type CodePeriode } from '@/domain/statistiques'
import { LIBELLE_ROLE, modifierMembre, nomMembre, rafraichirEquipe, useEquipe } from '@/services/equipe'
import { BarresSemaines } from './BarresSemaines'

const nf = new Intl.NumberFormat('fr-BE')
const euros = (n: number) => `${nf.format(n)} €`
const CLE_TAUX = 'stats.commission'

const INDICATEURS: { cle: keyof Chiffres; libelle: string }[] = [
  { cle: 'appels', libelle: 'Appels' },
  { cle: 'joints', libelle: 'Personnes jointes' },
  { cle: 'rdv', libelle: 'RDV / visites' },
  { cle: 'signatures', libelle: 'Mandats signés' },
  { cle: 'reperages', libelle: 'Repérages' },
  { cle: 'messages', libelle: 'Messages envoyés' },
]

function Tuile({ libelle, valeur, avant }: { libelle: string; valeur: number; avant: number }) {
  const diff = valeur - avant
  const Icone = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <p className="text-xs font-semibold text-doux">{libelle}</p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{nf.format(valeur)}</p>
      <p className="flex items-center gap-0.5 text-[11px] font-semibold text-doux">
        <Icone className="size-3.5" aria-hidden />
        {diff === 0 ? 'comme' : `${diff > 0 ? '+' : ''}${nf.format(diff)} vs`} période précédente
      </p>
    </div>
  )
}

function Membres() {
  const equipe = useEquipe()
  const { profil } = useAuth()
  const admin = profil?.role === 'admin'
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => void rafraichirEquipe(), [])
  if (!serveurConfigure || equipe.length === 0)
    return (
      <p className="text-sm text-doux">
        L’équipe apparaîtra ici une fois le serveur installé et les collègues invités (guide d’installation, étape « créer les utilisateurs »). Chacun pourra alors être « Suivi par » sur
        les fiches.
      </p>
    )
  const changer = async (id: string, patch: Parameters<typeof modifierMembre>[1]) => {
    setErreur(null)
    try {
      await modifierMembre(id, patch)
    } catch (e) {
      setErreur((e as Error).message)
    }
  }
  return (
    <>
      <ul className="flex flex-col gap-2">
        {equipe.map((m) => (
          <li key={m.id} className={`rounded-2xl bg-surface-2 p-3 ${m.actif ? '' : 'opacity-60'}`}>
            <p className="font-bold">
              {m.nom || m.email}
              {m.id === profil?.id && <span className="ml-1 text-xs font-semibold text-doux">(vous)</span>}
            </p>
            <p className="text-xs text-doux">{m.email}</p>
            {admin && m.id !== profil?.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Liste aria-label={`Rôle de ${m.nom || m.email}`} value={m.role} onChange={(e) => void changer(m.id, { role: e.target.value as typeof m.role })} className="h-9 w-auto text-sm">
                  {Object.entries(LIBELLE_ROLE).map(([code, libelle]) => (
                    <option key={code} value={code}>
                      {libelle}
                    </option>
                  ))}
                </Liste>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={m.actif} onChange={(e) => void changer(m.id, { actif: e.target.checked })} className="size-5 accent-[var(--color-primaire)]" />
                  Accès actif
                </label>
              </div>
            ) : (
              <p className="mt-1 text-xs font-semibold">
                {LIBELLE_ROLE[m.role]}
                {!m.actif && ' · accès coupé'}
              </p>
            )}
          </li>
        ))}
      </ul>
      {erreur && <p className="mt-2 text-xs font-semibold text-suivi-rouge">{erreur}</p>}
      {admin && <p className="mt-2 text-xs text-doux">Couper l’accès d’une personne la déconnecte de tous ses appareils ; ses fiches restent dans l’application.</p>}
    </>
  )
}

/** Équipe et statistiques : activité, comparaison, résultats par origine, valeur du portefeuille, membres. */
export default function EquipePage() {
  const [code, setCode] = useState<CodePeriode>('semaine')
  const [tableau, setTableau] = useState(false)
  const equipe = useEquipe()
  const donnees = useLiveQuery(async () => {
    const [interactions, pistes, contacts, taux] = await Promise.all([db.interactions.toArray(), db.pistes.toArray(), db.contacts.toArray(), db.meta.get(CLE_TAUX)])
    return { interactions, pistes, contacts, taux: typeof taux?.valeur === 'number' ? taux.valeur : 3 }
  }, [])
  const [taux, setTaux] = useState<string | null>(null)

  const vue = useMemo(() => {
    if (!donnees) return null
    const maintenant = new Date()
    const p = periode(code, maintenant)
    const auteurs = [...new Set<string | null>([...donnees.interactions.map((i: Interaction) => i.createdBy), ...donnees.pistes.map((x: Piste) => x.createdBy)])]
    return {
      actuels: chiffres(donnees.interactions, donnees.pistes, p),
      precedents: chiffres(donnees.interactions, donnees.pistes, p.precedente),
      semaines: parSemaine(donnees.interactions, maintenant, 12),
      parPersonne: auteurs.length > 1 ? auteurs.map((a) => ({ qui: a, c: chiffres(donnees.interactions, donnees.pistes, p, a) })) : [],
      origines: parOrigine(donnees.contacts, donnees.pistes, donnees.interactions),
      portefeuille: valeurPortefeuille(donnees.pistes, donnees.taux),
    }
  }, [donnees, code])

  if (!vue || !donnees) return <PageHeader titre="Équipe et statistiques" sousTitre="Chargement…" />
  const libelleSource = (s: string) => SOURCES_CONTACT.find((x) => x.code === s)?.libelle.replace(/ \(.*\)/, '') ?? 'Origine inconnue'

  return (
    <>
      <PageHeader titre="Équipe et statistiques" />
      <div className="flex flex-col gap-4">
        <Link to="/revue" className="presse flex items-center gap-3 rounded-3xl bg-surface p-3 pr-4 shadow-carte ring-2 ring-primaire/25 dark:shadow-none">
          <span className="degrade grid size-11 place-items-center rounded-2xl text-white">
            <ClipboardCheck className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Revue du vendredi</span>
            <span className="block text-xs text-doux">5 minutes pour faire le point et préparer la semaine</span>
          </span>
        </Link>
        <Link to="/doublons" className="presse flex items-center gap-3 rounded-3xl bg-surface p-3 pr-4 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">
          <span className="grid size-11 place-items-center rounded-2xl bg-surface-2 text-primaire-texte">
            <Copy className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Doublons</span>
            <span className="block text-xs text-doux">Fiches en double à fusionner</span>
          </span>
        </Link>

        <div className="flex gap-2" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <Puce key={p.code} actif={code === p.code} onClick={() => setCode(p.code)}>
              {p.libelle}
            </Puce>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INDICATEURS.map((k) => (
            <Tuile key={k.cle} libelle={k.libelle} valeur={vue.actuels[k.cle]} avant={vue.precedents[k.cle]} />
          ))}
        </div>
        <p className="-mt-2 px-1 text-xs text-doux">
          {vue.actuels.appels ? `${Math.round((vue.actuels.joints / vue.actuels.appels) * 100)} % des appels ont abouti à une conversation.` : 'Aucun appel noté sur la période.'}
        </p>

        <Card>
          <SectionTitle
            action={
              <button type="button" onClick={() => setTableau(!tableau)} className="flex items-center gap-1 text-xs font-bold text-primaire-texte" aria-pressed={tableau}>
                <Table2 className="size-4" aria-hidden /> {tableau ? 'Graphique' : 'Tableau'}
              </button>
            }
          >
            Appels des 12 dernières semaines
          </SectionTitle>
          {tableau ? (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-doux">
                  <th className="font-semibold">Semaine du</th>
                  <th className="text-right font-semibold">Appels</th>
                  <th className="text-right font-semibold">Joints</th>
                </tr>
              </thead>
              <tbody>
                {[...vue.semaines].reverse().map((s) => (
                  <tr key={s.debut.toISOString()} className="border-t border-bord/60">
                    <td className="py-1">{s.debut.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-1 text-right font-bold">{s.appels}</td>
                    <td className="py-1 text-right">{s.joints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <BarresSemaines semaines={vue.semaines} />
          )}
        </Card>

        {vue.parPersonne.length > 0 && (
          <Card>
            <SectionTitle>Par personne · {PERIODES.find((p) => p.code === code)!.libelle.toLowerCase()}</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-doux">
                    <th className="font-semibold">Qui</th>
                    <th className="text-right font-semibold">Appels</th>
                    <th className="text-right font-semibold">Joints</th>
                    <th className="text-right font-semibold">RDV</th>
                    <th className="text-right font-semibold">Mandats</th>
                  </tr>
                </thead>
                <tbody>
                  {vue.parPersonne.map(({ qui, c }) => (
                    <tr key={qui ?? 'moi'} className="border-t border-bord/60">
                      <td className="py-1.5 font-semibold">{nomMembre(equipe, qui) ?? (qui ? 'Ancien membre' : 'Avant connexion')}</td>
                      <td className="py-1.5 text-right">{c.appels}</td>
                      <td className="py-1.5 text-right">{c.joints}</td>
                      <td className="py-1.5 text-right">{c.rdv}</td>
                      <td className="py-1.5 text-right font-bold">{c.signatures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card>
          <SectionTitle>Résultats par origine</SectionTitle>
          <p className="-mt-1 mb-3 text-xs text-doux">Depuis le début : où trouvez-vous vos rendez-vous et vos mandats ?</p>
          <ul className="flex flex-col gap-2.5">
            {vue.origines.map((o) => (
              <li key={o.source} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{libelleSource(o.source)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-doux">
                    {o.fiches} fiche{o.fiches > 1 ? 's' : ''} · <strong className="text-texte">{o.rdv} RDV</strong> · {o.signes} signé{o.signes > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${o.tauxRdv} % arrivent au rendez-vous`}>
                  <div className="h-full rounded-full bg-[var(--viz-1)]" style={{ width: `${o.tauxRdv}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-doux">{o.tauxRdv} % arrivent au rendez-vous</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Valeur du portefeuille en cours</SectionTitle>
          <p className="text-3xl font-extrabold tabular-nums">{euros(vue.portefeuille.commission)}</p>
          <p className="text-sm text-doux">
            de commissions estimées sur {vue.portefeuille.pistes} piste{vue.portefeuille.pistes > 1 ? 's' : ''} au stade RDV / visite (prix connus : {euros(vue.portefeuille.prixTotal)}).
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            Commission moyenne
            <Saisie
              inputMode="decimal"
              aria-label="Taux de commission"
              value={taux ?? String(donnees.taux).replace('.', ',')}
              onChange={(e) => setTaux(e.target.value)}
              onBlur={() => {
                const n = Number((taux ?? '').replace(',', '.'))
                if (n > 0 && n < 20) void db.meta.put({ cle: CLE_TAUX, valeur: n })
                setTaux(null)
              }}
              className="h-10 w-20 text-center"
            />
            %
          </label>
        </Card>

        <Card>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Users className="size-5 text-primaire-texte" aria-hidden /> L’équipe
            </span>
          </SectionTitle>
          <Membres />
        </Card>
      </div>
    </>
  )
}
