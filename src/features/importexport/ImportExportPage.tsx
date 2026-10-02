import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArchiveRestore, Check, Download, FileSpreadsheet, FileUp, ShieldCheck, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { classesBouton } from '@/components/ui/Bouton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Liste } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/data/db'
import { annulerImport, importerContacts, importsPasses } from '@/data/repositories/importation'
import { CLE_DERNIERE_SAUVEGARDE, compterSauvegarde, creerSauvegarde, lireSauvegarde, restaurer } from '@/data/sauvegarde'
import { empreinte } from '@/domain/doublons'
import { CHAMPS_IMPORT, devinerColonnes, lireCsv, preparerImport, type CodeChamp } from '@/domain/importation'
import { nomAffiche } from '@/features/contacts/affichage'
import { aujourdhui, exporterCsv, exporterExcel, telecharger } from './exports'

const NOMS_TABLES: Record<string, [string, string]> = {
  contacts: ['contact', 'contacts'],
  interactions: ['échange', 'échanges'],
  biens: ['bien', 'biens'],
  pistes: ['piste', 'pistes'],
  evenements: ['rendez-vous', 'rendez-vous'],
  piecesJointes: ['document ou lien', 'documents et liens'],
  photos: ['photo', 'photos'],
  modeles: ['modèle', 'modèles'],
  campagnes: ['campagne', 'campagnes'],
  envois: ['envoi', 'envois'],
  argumentaires: ['argumentaire', 'argumentaires'],
}
const nombreDe = (table: string, n: number) => `${n} ${(NOMS_TABLES[table] ?? [table, table])[n > 1 ? 1 : 0]}`

function depuis(iso: string | undefined): string {
  if (!iso) return 'jamais'
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return j === 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`
}

function Sauvegarde() {
  const derniere = useLiveQuery(() => db.meta.get(CLE_DERNIERE_SAUVEGARDE), [])?.valeur as string | undefined
  const fichier = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const ancienne = !derniere || Date.now() - new Date(derniere).getTime() > 7 * 86_400_000

  const sauvegarder = async () => {
    const s = await creerSauvegarde(db)
    telecharger(new Blob([JSON.stringify(s)], { type: 'application/json' }), `prospectimmo-sauvegarde-${aujourdhui()}.json`)
    setMessage({ ok: true, texte: `Sauvegarde téléchargée : ${compterSauvegarde(s).filter((t) => t.nombre).map((t) => nombreDe(t.table, t.nombre)).join(', ')}.` })
  }
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setMessage(null)
    try {
      const s = lireSauvegarde(await f.text())
      const total = compterSauvegarde(s).reduce((n, t) => n + t.nombre, 0)
      const ok = await confirmer({
        titre: 'Restaurer cette sauvegarde ?',
        message: `Sauvegarde du ${new Date(s.creeLe).toLocaleString('fr-BE')} (${total} élément${total > 1 ? 's' : ''}). Seules les fiches absentes ou plus anciennes ici sont remises : rien de plus récent n’est écrasé.`,
        confirmer: 'Restaurer',
      })
      if (!ok) return
      const b = await restaurer(db, s)
      setMessage({ ok: true, texte: `${b.restaurees} élément${b.restaurees > 1 ? 's' : ''} restauré${b.restaurees > 1 ? 's' : ''}, ${b.ignorees} déjà à jour.` })
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message })
    }
  }
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primaire-texte" aria-hidden /> Sauvegarde complète
        </span>
      </SectionTitle>
      <p className={`text-sm ${ancienne ? 'font-semibold text-suivi-orange' : 'text-doux'}`}>
        Dernière sauvegarde : {depuis(derniere)}.{ancienne && ' Pensez-y une fois par semaine (le vendredi, par exemple).'}
      </p>
      <p className="text-xs text-doux">
        Un fichier avec tout : contacts, historique, pistes, biens, rendez-vous, modèles, campagnes. Les photos et documents restent sur le serveur et les appareils (le fichier contient
        leur description). Rangez-le dans votre Google Drive.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={sauvegarder} className={`${classesBouton('primaire')} w-full sm:flex-1`}>
          <Download className="size-5" aria-hidden /> Télécharger une sauvegarde
        </button>
        <button type="button" onClick={() => fichier.current?.click()} className={`${classesBouton('secondaire')} w-full sm:flex-1`}>
          <ArchiveRestore className="size-5" aria-hidden /> Restaurer
        </button>
      </div>
      <input ref={fichier} type="file" accept=".json,application/json" className="hidden" aria-label="Fichier de sauvegarde" onChange={(e) => void choisir(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      {message && <p className={`rounded-2xl p-3 text-sm font-semibold ${message.ok ? 'bg-suivi-vert/12 text-suivi-vert' : 'bg-suivi-rouge/10 text-suivi-rouge'}`}>{message.texte}</p>}
    </Card>
  )
}

function Exporter() {
  const [occupe, setOccupe] = useState<string | null>(null)
  const lancer = async (cle: string, f: () => Promise<void>) => {
    setOccupe(cle)
    try {
      await f()
    } finally {
      setOccupe(null)
    }
  }
  return (
    <Card className="flex flex-col gap-2">
      <SectionTitle>
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primaire-texte" aria-hidden /> Exporter
        </span>
      </SectionTitle>
      {(
        [
          ['contacts', 'Contacts (Excel)', () => exporterExcel(false)],
          ['tout', 'Tout : contacts, pistes, historique, rendez-vous (Excel)', () => exporterExcel(true)],
          ['csv', 'Contacts (CSV, pour un autre logiciel)', exporterCsv],
        ] as const
      ).map(([cle, libelle, f]) => (
        <button key={cle} type="button" disabled={occupe !== null} onClick={() => void lancer(cle, f)} className={`${classesBouton('secondaire')} h-auto min-h-12 w-full justify-start py-3 text-left`}>
          <Download className="size-5 shrink-0" aria-hidden /> {occupe === cle ? 'Préparation…' : libelle}
        </button>
      ))}
    </Card>
  )
}

interface Fichier {
  nom: string
  entetes: string[]
  lignes: unknown[][]
}

function Importer() {
  const input = useRef<HTMLInputElement>(null)
  const [fichier, setFichier] = useState<Fichier | null>(null)
  const [colonnes, setColonnes] = useState<CodeChamp[]>([])
  const [doublons, setDoublons] = useState<'ignorer' | 'creer'>('ignorer')
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const existants = useLiveQuery(async () => (await db.contacts.filter((c) => !c.archivedAt).toArray()).map((c) => ({ id: c.id, empreinte: c._empreinte ?? empreinte(c), nom: nomAffiche(c) })), [])
  const passes = useLiveQuery(() => importsPasses(), [resultat])

  const ouvrir = async (f: File | undefined) => {
    if (!f) return
    setErreur(null)
    setResultat(null)
    try {
      let lignes: unknown[][]
      if (/\.xlsx$/i.test(f.name)) {
        const { readSheet } = await import('read-excel-file/browser')
        lignes = (await readSheet(f)) as unknown[][]
      } else if (/\.(csv|txt)$/i.test(f.name)) lignes = lireCsv(await f.text())
      else throw new Error('Format non pris en charge : choisissez un fichier Excel (.xlsx) ou CSV. Un ancien fichier .xls s’enregistre en .xlsx depuis Excel.')
      if (lignes.length < 2) throw new Error('Le fichier est vide (il faut une ligne d’en-têtes, puis une ligne par contact).')
      const entetes = lignes[0]!.map((x) => String(x ?? '').trim())
      setFichier({ nom: f.name, entetes, lignes: lignes.slice(1) })
      setColonnes(devinerColonnes(entetes))
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  const apercu = fichier && existants ? preparerImport(fichier.lignes, colonnes, existants) : null
  const avecBase = apercu?.lignes.filter((l) => l.doublonDe).length ?? 0
  const dansFichier = apercu?.lignes.filter((l) => !l.doublonDe && l.doublonLigne).length ?? 0
  const aCreer = apercu ? (doublons === 'creer' ? apercu.lignes.length : apercu.lignes.length - avecBase - dansFichier) : 0
  const nomExistant = (id: string) => existants?.find((e) => e.id === id)?.nom ?? ''

  const importer = async () => {
    if (!apercu) return
    setOccupe(true)
    const r = await importerContacts(apercu.lignes, { doublons })
    setOccupe(false)
    setFichier(null)
    setResultat(`${r.creees} fiche${r.creees > 1 ? 's' : ''} importée${r.creees > 1 ? 's' : ''}${r.ignorees ? `, ${r.ignorees} doublon${r.ignorees > 1 ? 's' : ''} ignoré${r.ignorees > 1 ? 's' : ''}` : ''}. Étiquette : « ${r.etiquette} ».`)
  }
  const annuler = async (etiquette: string, n: number) => {
    const ok = await confirmer({ titre: 'Annuler cet import ?', message: `Les ${n} fiches de « ${etiquette} » sont archivées (récupérables, jamais effacées).`, confirmer: 'Annuler l’import' })
    if (ok) setResultat(`${await annulerImport(etiquette)} fiche(s) archivée(s).`)
  }

  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>
        <span className="flex items-center gap-2">
          <FileUp className="size-5 text-primaire-texte" aria-hidden /> Importer des contacts
        </span>
      </SectionTitle>
      {!fichier ? (
        <>
          <p className="text-xs text-doux">Un fichier Excel (.xlsx) ou CSV avec une ligne d’en-têtes (Nom, Prénom, Téléphone, Email, Adresse…) puis une ligne par contact. Les colonnes sont reconnues automatiquement.</p>
          <button type="button" onClick={() => input.current?.click()} className={`${classesBouton('primaire')} w-full`}>
            <FileUp className="size-5" aria-hidden /> Choisir un fichier
          </button>
        </>
      ) : (
        <>
          <p className="text-sm">
            <strong>{fichier.nom}</strong> · {fichier.lignes.length} ligne{fichier.lignes.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-doux">Correspondance des colonnes</p>
          <ul className="flex flex-col gap-2">
            {fichier.entetes.map((e, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{e || `Colonne ${i + 1}`}</span>
                  <span className="block truncate text-[11px] text-doux">{fichier.lignes.slice(0, 2).map((l) => String(l[i] instanceof Date ? (l[i] as Date).toLocaleDateString('fr-BE') : (l[i] ?? ''))).filter(Boolean).join(' · ') || 'vide'}</span>
                </span>
                <Liste aria-label={`Colonne ${e || i + 1}`} value={colonnes[i] ?? 'ignorer'} onChange={(ev) => setColonnes(colonnes.map((c, j) => (j === i ? (ev.target.value as CodeChamp) : c)))} className="h-10 text-sm">
                  {CHAMPS_IMPORT.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.libelle}
                    </option>
                  ))}
                </Liste>
              </li>
            ))}
          </ul>
          {apercu && (
            <div className="rounded-2xl bg-surface-2 p-3 text-sm">
              <p>
                <strong>{apercu.lignes.length}</strong> contact{apercu.lignes.length > 1 ? 's' : ''} lu{apercu.lignes.length > 1 ? 's' : ''}
                {apercu.vides ? `, ${apercu.vides} ligne(s) vide(s) ignorée(s)` : ''}.
              </p>
              {(avecBase > 0 || dansFichier > 0) && (
                <>
                  <p className="mt-1 flex items-center gap-1.5 font-semibold text-suivi-orange">
                    <AlertTriangle className="size-4" aria-hidden /> {avecBase} déjà dans Prospect’Immo, {dansFichier} en double dans le fichier
                  </p>
                  <ul className="mt-1 max-h-28 overflow-y-auto text-xs text-doux">
                    {apercu.lignes
                      .filter((l) => l.doublonDe)
                      .slice(0, 20)
                      .map((l) => (
                        <li key={l.ligne}>
                          Ligne {l.ligne} : déjà « {nomExistant(l.doublonDe!)} »
                        </li>
                      ))}
                  </ul>
                  <div className="mt-2 flex flex-col gap-1">
                    {(
                      [
                        ['ignorer', 'Ne pas importer les doublons (conseillé)'],
                        ['creer', 'Tout importer quand même (à fusionner ensuite dans « Doublons »)'],
                      ] as const
                    ).map(([v, l]) => (
                      <label key={v} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="doublons" checked={doublons === v} onChange={() => setDoublons(v)} className="size-4 accent-[var(--color-primaire)]" /> {l}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setFichier(null)} className={`${classesBouton('fantome')} h-12 flex-1`}>
              Annuler
            </button>
            <button type="button" disabled={occupe || aCreer === 0} onClick={importer} className={`${classesBouton('primaire')} h-12 flex-[2]`}>
              {occupe ? 'Import…' : `Importer ${aCreer} fiche${aCreer > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
      <input ref={input} type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="Fichier à importer" onChange={(e) => void ouvrir(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      {erreur && <p className="rounded-2xl bg-suivi-rouge/10 p-3 text-sm font-semibold text-suivi-rouge">{erreur}</p>}
      {resultat && (
        <p className="flex items-center gap-2 rounded-2xl bg-suivi-vert/12 p-3 text-sm font-semibold text-suivi-vert">
          <Check className="size-4 shrink-0" aria-hidden /> {resultat}{' '}
          <Link to="/contacts" className="underline">
            Voir les contacts
          </Link>
        </p>
      )}
      {!!passes?.length && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-doux">Imports précédents</p>
          <ul className="flex flex-col gap-1">
            {passes.map((p) => (
              <li key={p.etiquette} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span className="truncate">
                  {p.etiquette.replace(/^import /, 'Import du ')} · {p.fiches} fiche{p.fiches > 1 ? 's' : ''}
                </span>
                <button type="button" onClick={() => void annuler(p.etiquette, p.fiches)} className="flex shrink-0 items-center gap-1 text-xs font-bold text-suivi-rouge">
                  <Undo2 className="size-3.5" aria-hidden /> Annuler
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

/** Import, export et sauvegarde. */
export default function ImportExportPage() {
  return (
    <>
      <PageHeader titre="Import, export, sauvegarde" />
      <div className="flex flex-col gap-4">
        <Sauvegarde />
        <Importer />
        <Exporter />
      </div>
    </>
  )
}
