import { AlarmClockOff, Check, DoorOpen, Eye, Phone, Signpost, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { VignetteBien } from '@/components/Photos'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Saisie } from '@/components/ui/Champ'
import { confirmer } from '@/components/ui/Confirmation'
import { StatusDot } from '@/components/ui/StatusDot'
import { contacts } from '@/data/repositories/contacts'
import { pistes } from '@/data/repositories/pistes'
import { depuisDateLocale, versDateLocale } from '@/domain/dates'
import type { Priorite } from '@/domain/priorite'
import { prixLisible } from '@/domain/prospection'
import { dateRelance, DELAIS_RELANCE } from '@/domain/relance'
import { ouvrirMenuContact } from '@/features/actions/actions'
import { initiales } from '@/features/contacts/affichage'
import type { PisteVue } from '@/features/prospection/usePistes'
import type { Suivable } from './useSuivables'

export function Visuel({ s }: { s: Suivable }) {
  if (s.piste && s.bienId)
    return (
      <span className="relative isolate size-11 shrink-0">
        <VignetteBien bienId={s.bienId} className="size-11 rounded-2xl" />
        <span className={`absolute inset-0 -z-10 grid place-items-center rounded-2xl ${s.categorie === 'annonce' ? 'bg-annonce/15 text-annonce' : 'bg-maison-vide/15 text-maison-vide'}`}>
          {s.categorie === 'annonce' ? <Signpost className="size-5" /> : <DoorOpen className="size-5" />}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-[3px]">
          <StatusDot couleur={s.couleur} taille="sm" />
        </span>
      </span>
    )
  return <Avatar initiales={s.contact ? initiales(s.contact) : ''} cle={s.cle} couleur={s.couleur} />
}

export function BoutonAppel({ s }: { s: Suivable }) {
  const c = s.contact
  if (!c || c.nePasContacter || (c._telNorm.length === 0 && c.emails.length === 0)) return <span className="size-11 shrink-0" />
  return (
    <button
      type="button"
      onClick={() => ouvrirMenuContact(c.id, null, s.piste?.id ?? null)}
      className="presse grid size-11 shrink-0 place-items-center rounded-full bg-primaire-doux text-primaire-texte"
      aria-label={`Contacter ${s.titre}`}
    >
      <Phone className="size-5" aria-hidden />
    </button>
  )
}

/** « Qui appeler en premier » : le classement du jour, avec la raison de chaque rang. */
export function TopAppels({ lignes }: { lignes: { suivable: Suivable; priorite: Priorite }[] }) {
  if (lignes.length === 0) return null
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <Trophy className="size-5 text-primaire-texte" aria-hidden />
        <h2 className="text-base font-bold">Qui appeler en premier</h2>
      </div>
      <p className="px-4 text-xs text-doux">Classés selon vos chances de réussite : annonce retirée, prix en baisse, prospect chaud, tout juste repéré…</p>
      <ol className="mt-1 pb-1">
        {lignes.map(({ suivable: s, priorite }, i) => (
          <li key={s.cle} className="flex items-center gap-2 py-2 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
            <span className="w-5 shrink-0 text-center text-sm font-extrabold text-doux tabular-nums">{i + 1}</span>
            <Link to={s.lien} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
              <Visuel s={s} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{s.titre}</span>
                <span className="line-clamp-2 text-xs leading-snug text-doux">{priorite.raisons.join(' · ')}</span>
              </span>
            </Link>
            <BoutonAppel s={s} />
          </li>
        ))}
      </ol>
    </Card>
  )
}

const RACCOURCIS = DELAIS_RELANCE.filter((d) => d.code !== '6m')

/** « Aucune piste sans prochaine action » : chaque fiche active doit avoir une relance datée. */
export function SansAction({ lignes }: { lignes: Suivable[] }) {
  if (lignes.length === 0) return null

  const planifier = (s: Suivable, code: (typeof RACCOURCIS)[number]['code']) => {
    const prochaineRelanceAt = depuisDateLocale(versDateLocale(dateRelance(code).toISOString()))
    return s.piste ? pistes.modifier(s.piste.id, { prochaineRelanceAt }) : contacts.modifier(s.contact!.id, { prochaineRelanceAt })
  }

  const nePlusSuivre = async (s: Suivable) => {
    const ok = await confirmer({
      titre: `Ne plus suivre ${s.titre} ?`,
      message: 'La fiche est archivée (jamais effacée). Vous pourrez la restaurer à tout moment.',
      confirmer: 'Archiver',
    })
    if (!ok) return
    if (s.piste) await pistes.archiver(s.piste.id)
    else await contacts.archiver(s.contact!.id)
  }

  return (
    <Card className="overflow-hidden !p-0 ring-2 ring-suivi-rouge/25">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <AlarmClockOff className="size-5 text-suivi-rouge" aria-hidden />
        <h2 className="text-base font-bold">Sans prochaine action</h2>
        <span className="rounded-full bg-suivi-rouge/12 px-2 py-0.5 text-xs font-bold text-suivi-rouge">{lignes.length}</span>
      </div>
      <p className="px-4 text-xs text-doux">Aucune relance prévue : ces fiches risquent d’être oubliées. Choisissez la suite en un appui.</p>
      <ul className="mt-2 pb-2">
        {lignes.slice(0, 8).map((s) => (
          <li key={s.cle} className="px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
            <div className="flex items-center gap-3">
              <Link to={s.lien} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                <Visuel s={s} />
                <span className="truncate text-[15px] font-bold">{s.titre}</span>
              </Link>
              <BoutonAppel s={s} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
              {RACCOURCIS.map((d) => (
                <button key={d.code} type="button" onClick={() => planifier(s, d.code)} className="presse h-8 rounded-full bg-primaire-doux px-3 text-xs font-bold text-primaire-texte">
                  {d.libelle}
                </button>
              ))}
              <button type="button" onClick={() => nePlusSuivre(s)} className="presse h-8 rounded-full bg-surface-2 px-3 text-xs font-bold text-doux">
                Ne plus suivre
              </button>
            </div>
          </li>
        ))}
      </ul>
      {lignes.length > 8 && <p className="px-4 pb-4 text-xs font-semibold text-doux">… et {lignes.length - 8} autres.</p>}
    </Card>
  )
}

function LigneVeille({ vue }: { vue: PisteVue }) {
  const { piste, titre } = vue
  const [prix, setPrix] = useState<string | null>(null)
  const estAffiche = !piste.sourceUrl
  const valider = async () => {
    const p = Number((prix ?? '').replace(/[^\d]/g, ''))
    if (p) await pistes.veillePrix(piste, p)
    setPrix(null)
  }
  return (
    <li className="px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
      <Link to={`/pistes/${piste.id}`} className="block active:opacity-70">
        <span className="block truncate text-[15px] font-bold">{titre}</span>
        <span className="block text-xs text-doux">
          {estAffiche ? 'Affiche repérée' : 'Annonce en ligne'}
          {piste.prix ? ` · ${prixLisible(piste.prix)}` : ''} · vérifier {estAffiche ? 'qu’elle est toujours là' : 'le prix et qu’elle est toujours en ligne'}
        </span>
      </Link>
      {prix === null ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => pistes.veilleToujoursLa(piste)} className="presse h-8 rounded-full bg-suivi-vert/12 px-3 text-xs font-bold text-suivi-vert">
            <Check className="mr-1 inline size-3.5" aria-hidden />
            {estAffiche ? 'Toujours là' : 'Toujours en ligne'}
          </button>
          {!estAffiche && (
            <button type="button" onClick={() => setPrix('')} className="presse h-8 rounded-full bg-primaire-doux px-3 text-xs font-bold text-primaire-texte">
              Prix changé
            </button>
          )}
          <button
            type="button"
            onClick={() => pistes.veilleChangement(piste, estAffiche ? 'disparue' : 'retiree')}
            className="presse h-8 rounded-full bg-suivi-rouge/10 px-3 text-xs font-bold text-suivi-rouge"
          >
            {estAffiche ? 'Disparue' : 'Retirée'}
          </button>
          {estAffiche && (
            <button type="button" onClick={() => pistes.veilleChangement(piste, 'agence')} className="presse h-8 rounded-full bg-suivi-rouge/10 px-3 text-xs font-bold text-suivi-rouge">
              Panneau d’agence
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Saisie inputMode="numeric" autoFocus placeholder="Nouveau prix (€)" aria-label={`Nouveau prix pour ${titre}`} value={prix} onChange={(e) => setPrix(e.target.value)} className="h-10 flex-1" />
          <button type="button" onClick={valider} className="presse h-10 rounded-2xl bg-primaire px-4 text-sm font-bold text-white">
            OK
          </button>
        </div>
      )}
    </li>
  )
}

/** Veille : annonces et affiches à revérifier aujourd'hui (en un appui). */
export function Veille({ lignes }: { lignes: PisteVue[] }) {
  if (lignes.length === 0) return null
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <Eye className="size-5 text-annonce" aria-hidden />
        <h2 className="text-base font-bold">À revérifier</h2>
        <span className="rounded-full bg-annonce/15 px-2 py-0.5 text-xs font-bold text-annonce">{lignes.length}</span>
      </div>
      <p className="px-4 text-xs text-doux">Une annonce retirée, une baisse de prix ou une affiche disparue = le bon moment pour appeler.</p>
      <ul className="mt-1 pb-1">
        {lignes.map((v) => (
          <LigneVeille key={v.piste.id} vue={v} />
        ))}
      </ul>
    </Card>
  )
}

