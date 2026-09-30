import { useLiveQuery } from 'dexie-react-hooks'
import {
  ClipboardPaste,
  ExternalLink,
  File as IconeFichier,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  Paperclip,
  RotateCcw,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Card } from '@/components/ui/Card'
import { Champ, Saisie, Zone } from '@/components/ui/Champ'
import { piecesJointes } from '@/data/repositories/piecesJointes'
import type { EntiteLiee, PieceJointe } from '@/data/types'
import { detecterSource, FORMATS_ACCEPTES, normaliserUrl, tailleLisible, typeFichier, type TypeFichier } from '@/domain/liens'

const ICONES: Record<TypeFichier | 'lien', { icone: LucideIcon; classe: string }> = {
  pdf: { icone: FileText, classe: 'bg-suivi-rouge/12 text-suivi-rouge' },
  word: { icone: FileText, classe: 'bg-portefeuille/12 text-portefeuille' },
  tableur: { icone: FileSpreadsheet, classe: 'bg-suivi-vert/12 text-suivi-vert' },
  image: { icone: FileImage, classe: 'bg-maison-vide/12 text-maison-vide' },
  autre: { icone: IconeFichier, classe: 'bg-surface-2 text-doux' },
  lien: { icone: Link2, classe: 'bg-annonce/12 text-annonce' },
}

const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })

async function ouvrir(p: PieceJointe, setErreur: (e: string | null) => void) {
  if (p.type === 'lien' && p.url) {
    window.open(p.url, '_blank', 'noopener')
    return
  }
  const blob = await piecesJointes.contenu(p.id)
  if (!blob) {
    setErreur('Ce document n’est pas encore sur cet appareil : il sera disponible après la synchronisation.')
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  // Un PDF ou une image s'affiche directement ; un Word ou Excel s'ouvre avec l'application adaptée.
  const t = typeFichier(p.nomFichier ?? '', p.mime ?? '')
  if (t !== 'pdf' && t !== 'image') a.download = p.nomFichier ?? p.titre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function FormulaireLien({ entite, entiteId, fermer }: { entite: EntiteLiee; entiteId: string; fermer: () => void }) {
  const [url, setUrl] = useState('')
  const [titre, setTitre] = useState('')
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const valide = normaliserUrl(url)

  const coller = async () => {
    try {
      setUrl(await navigator.clipboard.readText())
    } catch {
      setErreur('Collez le lien dans le champ (appui long → Coller).')
    }
  }

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await piecesJointes.ajouterLien(entite, entiteId, { url, titre, note })
      fermer()
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  return (
    <form noValidate onSubmit={enregistrer} className="flex flex-col gap-3 rounded-2xl border border-bord bg-surface-2/50 p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Champ libelle="Lien de l’annonce ou du site">
            <Saisie
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              placeholder="https://www.immoweb.be/…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setErreur(null)
              }}
            />
          </Champ>
        </div>
        {'clipboard' in navigator && (
          <button type="button" onClick={coller} className="flex h-12 items-center gap-1.5 rounded-xl border border-bord bg-surface px-3 text-sm font-semibold">
            <ClipboardPaste className="size-4" aria-hidden /> Coller
          </button>
        )}
      </div>
      {valide && <p className="-mt-1 text-xs text-doux">Source reconnue : <strong>{detecterSource(valide).libelle}</strong></p>}
      <Champ libelle="Titre (facultatif)">
        <Saisie value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Maison 3 façades — 245 000 €" />
      </Champ>
      <Champ libelle="Note (facultatif)">
        <Zone rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Champ>
      {erreur && <p className="text-sm font-semibold text-suivi-rouge">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={fermer} className="h-12 flex-1 rounded-xl border border-bord text-sm font-semibold">
          Annuler
        </button>
        <button type="submit" disabled={!valide} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-extrabold text-accent-ink disabled:opacity-50">
          Ajouter le lien
        </button>
      </div>
    </form>
  )
}

function Element({ p, setErreur }: { p: PieceJointe; setErreur: (e: string | null) => void }) {
  const retire = !!p.archivedAt
  const t = p.type === 'lien' ? 'lien' : typeFichier(p.nomFichier ?? '', p.mime ?? '')
  const { icone: Icone, classe } = ICONES[t]
  const source = p.url ? detecterSource(p.url).libelle : null
  const titre = p.titre || (p.type === 'lien' ? `Annonce ${source}` : p.nomFichier) || 'Document'
  const details = [p.type === 'lien' ? source : p.taille != null ? tailleLisible(p.taille) : null, `ajouté le ${dateCourte(p.createdAt)}`]
    .filter(Boolean)
    .join(' · ')

  const retirer = async () => {
    if (confirm(`Retirer « ${titre} » de la fiche ?\nIl reste récupérable via « Éléments retirés ».`)) await piecesJointes.archiver(p.id)
  }

  return (
    <li className={`flex items-center gap-3 py-3 ${retire ? 'opacity-60' : ''}`}>
      <button type="button" onClick={() => ouvrir(p, setErreur)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${classe}`}>
          <Icone className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold leading-snug">
            <span className="line-clamp-2 break-words">
              {titre}
              {p.type === 'lien' && <ExternalLink className="ml-1 inline size-3.5 align-[-2px] text-doux" aria-hidden />}
            </span>
          </span>
          <span className="block truncate text-xs text-doux">{details}</span>
          {p.note && <span className="mt-0.5 block text-sm">{p.note}</span>}
        </span>
      </button>
      {retire ? (
        <button type="button" onClick={() => piecesJointes.restaurer(p.id)} className="grid size-11 place-items-center rounded-full text-doux" aria-label={`Restaurer ${titre}`}>
          <RotateCcw className="size-5" />
        </button>
      ) : (
        <button type="button" onClick={retirer} className="grid size-11 place-items-center rounded-full text-doux" aria-label={`Retirer ${titre}`}>
          <Trash2 className="size-5" />
        </button>
      )}
    </li>
  )
}

/** Documents (PDF, Word…) et liens Internet joints à une fiche. */
export function PiecesJointes({ entite, entiteId }: { entite: EntiteLiee; entiteId: string }) {
  const liste = useLiveQuery(() => piecesJointes.pour(entite, entiteId), [entite, entiteId])
  const [formLien, setFormLien] = useState(false)
  const [voirRetires, setVoirRetires] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const actifs = liste?.filter((p) => !p.archivedAt) ?? []
  const retires = liste?.filter((p) => p.archivedAt) ?? []

  const ajouterFichiers = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return
    setErreur(null)
    setEnvoi(true)
    const erreurs: string[] = []
    for (const f of Array.from(fichiers)) {
      try {
        await piecesJointes.ajouterFichier(entite, entiteId, f)
      } catch (e) {
        erreurs.push((e as Error).message)
      }
    }
    setEnvoi(false)
    if (erreurs.length) setErreur(erreurs.join('\n'))
    if (input.current) input.current.value = ''
  }

  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={envoi}
          onClick={() => input.current?.click()}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-bold text-accent disabled:opacity-60 dark:bg-accent dark:text-accent-ink"
        >
          <Paperclip className="size-5" aria-hidden /> {envoi ? 'Ajout…' : 'Document'}
        </button>
        <button
          type="button"
          onClick={() => setFormLien(true)}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-bord text-sm font-bold"
        >
          <Link2 className="size-5" aria-hidden /> Lien Internet
        </button>
      </div>
      <input ref={input} type="file" multiple accept={FORMATS_ACCEPTES} className="hidden" onChange={(e) => ajouterFichiers(e.target.files)} />
      <p className="mt-2 text-xs text-doux">PDF, Word, Excel ou photo (25 Mo max.), ou le lien d’une annonce Immoweb, 2ememain, d’une agence…</p>

      {formLien && (
        <div className="mt-3">
          <FormulaireLien entite={entite} entiteId={entiteId} fermer={() => setFormLien(false)} />
        </div>
      )}

      {erreur && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-suivi-rouge/10 p-3 text-sm text-suivi-rouge">
          <span className="flex-1 whitespace-pre-line">{erreur}</span>
          <button type="button" onClick={() => setErreur(null)} aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>
      )}

      {liste && actifs.length === 0 && !formLien && <p className="mt-4 text-center text-sm text-doux">Aucun document ni lien pour l’instant.</p>}

      {actifs.length > 0 && (
        <ul className="mt-2 divide-y divide-bord">
          {actifs.map((p) => (
            <Element key={p.id} p={p} setErreur={setErreur} />
          ))}
        </ul>
      )}

      {retires.length > 0 && (
        <div className="mt-2 border-t border-bord pt-2">
          <button type="button" onClick={() => setVoirRetires((v) => !v)} className="h-10 text-xs font-semibold text-doux underline">
            {voirRetires ? 'Masquer' : 'Afficher'} les éléments retirés ({retires.length})
          </button>
          {voirRetires && (
            <ul className="divide-y divide-bord">
              {retires.map((p) => (
                <Element key={p.id} p={p} setErreur={setErreur} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
