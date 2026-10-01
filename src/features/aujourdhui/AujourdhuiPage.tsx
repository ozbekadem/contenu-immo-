import { useLiveQuery } from 'dexie-react-hooks'
import { Headset, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/Card'
import { FOND_COULEUR } from '@/components/ui/StatusDot'
import type { Couleur } from '@/domain/relance'
import type { FiltreRapide } from '@/features/contacts/filtres'
import { classer } from '@/domain/priorite'
import { usePistes } from '@/features/prospection/usePistes'
import { Puce } from '@/components/ui/Champ'
import { interactions } from '@/data/repositories/interactions'
import type { Contact } from '@/data/types'
import { aMaturite, anniversaires, entonnoir } from '@/domain/quotidien'
import { useContactsColores } from '@/features/contacts/useContacts'
import { RendezVousDuJour } from '@/features/agenda/composants'
import { SansAction, TopAppels, Veille } from './Sections'
import { AMaturite, Anniversaires, Entonnoir } from './Suivi'
import { fileAppels, filtrerCategorie, FILTRES_CATEGORIE, useSuivables, type FiltreCategorie } from './useSuivables'

const CLE_FILTRE = 'aujourdhui.filtre'

function filtreMemorise(): FiltreCategorie {
  try {
    const f = localStorage.getItem(CLE_FILTRE)
    return FILTRES_CATEGORIE.some((x) => x.code === f) ? (f as FiltreCategorie) : 'tout'
  } catch {
    return 'tout'
  }
}

const TUILES: { couleur: Couleur; libelle: string; filtre: FiltreRapide }[] = [
  { couleur: 'rouge', libelle: 'En retard', filtre: 'retard' },
  { couleur: 'orange', libelle: "Aujourd'hui", filtre: 'aujourdhui' },
  { couleur: 'jaune', libelle: 'Semaine', filtre: 'semaine' },
  { couleur: 'vert', libelle: 'À jour', filtre: 'ajour' },
]

function salutation(d: Date): string {
  const h = d.getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

export default function AujourdhuiPage() {
  const { liste, maintenant } = useSuivables()
  const { liste: vuesPistes } = usePistes()
  const { liste: contactsColores } = useContactsColores()
  const signatures = useLiveQuery(() => interactions.signatures(), [])
  const [filtre, setFiltre] = useState<FiltreCategorie>(filtreMemorise)
  const choisirFiltre = (f: FiltreCategorie) => {
    setFiltre(f)
    try {
      localStorage.setItem(CLE_FILTRE, f)
    } catch {
      /* préférence non mémorisée : sans gravité */
    }
  }

  const { compte, aTraiter, top, sansAction, aVerifier, aAppeler, maturite, parCategorie } = useMemo(() => {
    const tous = liste ?? []
    const parCategorie = (f: FiltreCategorie) => filtrerCategorie(tous, f).filter((s) => s.couleur === 'rouge' || s.couleur === 'orange').length
    const actifs = filtrerCategorie(tous, filtre)
    const compte = (c: Couleur) => tous.filter((l) => l.couleur === c).length
    const top = classer(actifs, maintenant).map(({ element, priorite }) => ({ suivable: element, priorite }))
    const dansTop = new Set(top.map((t) => t.suivable.cle))
    // Toute fiche active doit avoir une prochaine action datée.
    const sansAction = actifs.filter((s) => !s.contact?.nePasContacter && !s.prochaineRelanceAt && !dansTop.has(s.cle))
    const aVerifier = (vuesPistes ?? []).filter(
      ({ piste }) =>
        (filtre === 'tout' || filtre === piste.categorie) &&
        !piste.archivedAt &&
        piste.veilleEtat === 'actif' && piste.statut !== 'gagne' && piste.statut !== 'perdu' && piste.veilleProchaine && new Date(piste.veilleProchaine) <= maintenant,
    )
    const maturite = aMaturite(
      actifs.filter((s) => !s.contact?.nePasContacter).map((s) => ({ quoi: s, datesCles: s.datesCles })),
      maintenant,
    )
    return {
      compte,
      aTraiter: compte('rouge') + compte('orange'),
      top,
      sansAction,
      aVerifier,
      aAppeler: fileAppels(actifs, maintenant).length,
      maturite,
      parCategorie,
    }
  }, [liste, vuesPistes, maintenant, filtre])

  const statsEntonnoir = useMemo(() => entonnoir((vuesPistes ?? []).map((v) => v.piste)), [vuesPistes])

  const fetes = useMemo(() => {
    if (!contactsColores) return []
    const actifs = contactsColores.map((c) => c.contact).filter((c) => !c.archivedAt)
    const parId = new Map(actifs.map((c) => [c.id, c]))
    const elements: { quoi: Contact; type: 'naissance' | 'signature'; date: string | null }[] = actifs.map((c) => ({ quoi: c, type: 'naissance', date: c.dateNaissance }))
    for (const i of signatures ?? []) {
      const c = parId.get(i.contactId!)
      if (c) elements.push({ quoi: c, type: 'signature', date: i.date })
    }
    return anniversaires(elements, maintenant)
  }, [contactsColores, signatures, maintenant])

  const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(maintenant)

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau d'accueil */}
      <section className="degrade relative overflow-hidden rounded-[28px] p-5 text-white shadow-primaire">
        <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <p className="relative text-sm font-semibold text-white/80 first-letter:uppercase">{date}</p>
        <h1 className="relative mt-1 text-[26px] font-extrabold leading-tight tracking-tight">{salutation(maintenant)} !</h1>
        <p className="relative mt-1 text-[15px] font-medium text-white/90">
          {liste === undefined
            ? '…'
            : aTraiter === 0
              ? 'Aucune relance urgente. Belle journée de prospection.'
              : `${aTraiter} relance${aTraiter > 1 ? 's' : ''} à traiter aujourd'hui.`}
        </p>

        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {TUILES.map(({ couleur, libelle, filtre }) => (
            <Link
              key={couleur}
              to={`/contacts?filtre=${filtre}`}
              className="presse relative rounded-2xl bg-white/15 px-1 pb-2.5 pt-3 text-center ring-1 ring-white/20 backdrop-blur"
            >
              <span className={`absolute right-2 top-2 size-2.5 rounded-full ring-2 ring-white/70 ${FOND_COULEUR[couleur]}`} />
              <div className="text-[26px] font-extrabold leading-none">{liste ? compte(couleur) : '–'}</div>
              <div className="mt-1.5 text-[11px] font-semibold leading-tight text-white/90">{libelle}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="group" aria-label="Afficher">
        {FILTRES_CATEGORIE.map(({ code, libelle }) => {
          const n = liste ? parCategorie(code) : 0
          return (
            <Puce key={code} actif={filtre === code} onClick={() => choisirFiltre(code)}>
              {libelle}
              {n > 0 && <span className="ml-1.5 opacity-70">{n}</span>}
            </Puce>
          )
        })}
      </div>

      {aAppeler > 0 && (
        <Link to={`/session?filtre=${filtre}`} className="presse flex items-center gap-3 rounded-3xl bg-surface p-3 pr-4 shadow-carte ring-2 ring-primaire/25 dark:shadow-none">
          <span className="degrade grid size-12 place-items-center rounded-2xl text-white shadow-primaire">
            <Headset className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Lancer la session d’appels</span>
            <span className="block text-xs text-doux">
              {aAppeler} personne{aAppeler > 1 ? 's' : ''} à appeler, une par une, avec l’argumentaire adapté
            </span>
          </span>
        </Link>
      )}

      <RendezVousDuJour maintenant={maintenant} />
      <TopAppels lignes={top} />
      {aAppeler > top.length && (
        <Link to={`/session?filtre=${filtre}`} className="-mt-2 px-4 text-center text-sm font-bold text-primaire-texte">
          Et {aAppeler - top.length} autre{aAppeler - top.length > 1 ? 's' : ''} dans la session d’appels
        </Link>
      )}
      <Veille lignes={aVerifier} />
      <AMaturite lignes={maturite} />
      <SansAction lignes={sansAction} />
      <Anniversaires lignes={fetes} />
      {(filtre === 'tout' || filtre === 'annonce' || filtre === 'maison_vide') && <Entonnoir e={statsEntonnoir} />}

      {liste && aTraiter === 0 && (
        <Card className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-suivi-vert/12 text-suivi-vert">
            <PartyPopper className="size-5" />
          </span>
          <p className="text-sm font-medium">Tout est à jour. Profitez-en pour repérer de nouveaux biens !</p>
        </Card>
      )}
    </div>
  )
}
