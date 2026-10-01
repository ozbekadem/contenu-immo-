import { CakeSlice, ChevronRight, Filter, Hourglass, MessageCircle, MessageSquare } from 'lucide-react'
import { Link } from 'react-router'
import { useNomAgence } from '@/app/agence'
import { useAuth } from '@/app/auth'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import type { Contact } from '@/data/types'
import { LIBELLE_STATUT, TYPES_DATE_CLE } from '@/domain/prospection'
import { ETAPES_ENTONNOIR, messageAnniversaire, quandLisible, type Anniversaire, type Entonnoir as DonneesEntonnoir, type Maturite } from '@/domain/quotidien'
import { lancerAction } from '@/features/actions/actions'
import { initiales, nomAffiche } from '@/features/contacts/affichage'
import { BoutonAppel, Visuel } from './Sections'
import type { Suivable } from './useSuivables'

const TEINTE_ETAPE: Record<string, string> = {
  a_contacter: 'bg-primaire/35',
  en_cours: 'bg-primaire/55',
  rdv: 'bg-primaire/80',
  gagne: 'bg-suivi-vert',
}

/** Entonnoir de prospection : combien de pistes à chaque étape, et le taux de réussite. */
export function Entonnoir({ e }: { e: DonneesEntonnoir }) {
  if (e.total === 0 && e.etapes.perdu === 0) return null
  const max = Math.max(...ETAPES_ENTONNOIR.map((s) => e.etapes[s]), 1)
  return (
    <Card>
      <Link to="/prospection" className="flex items-center gap-2 active:opacity-70">
        <Filter className="size-5 text-primaire-texte" aria-hidden />
        <h2 className="flex-1 text-base font-bold">Entonnoir de prospection</h2>
        <ChevronRight className="size-5 text-doux" aria-hidden />
      </Link>
      <ul className="mt-3 flex flex-col gap-2">
        {ETAPES_ENTONNOIR.map((s) => (
          <li key={s} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-semibold">{LIBELLE_STATUT[s]}</span>
            <span className="h-7 flex-1">
              <span
                className={`flex h-full min-w-8 items-center justify-end rounded-lg px-2 text-sm font-extrabold ${TEINTE_ETAPE[s]} ${s === 'gagne' || s === 'rdv' ? 'text-white' : 'text-texte'}`}
                style={{ width: `${Math.max((e.etapes[s] / max) * 100, 8)}%` }}
              >
                {e.etapes[s]}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-doux">
        {e.tauxReussite === null
          ? 'Le taux de réussite s’affichera dès la première piste signée ou abandonnée.'
          : `${e.tauxReussite} % des pistes terminées ont abouti à une signature (${e.etapes.gagne} signée${e.etapes.gagne > 1 ? 's' : ''}, ${e.etapes.perdu} abandonnée${e.etapes.perdu > 1 ? 's' : ''}).`}
      </p>
    </Card>
  )
}

/** « À maturité » : la date clé approche (projet de vente, fin de bail…) — c'est le moment d'appeler. */
export function AMaturite({ lignes }: { lignes: Maturite<Suivable>[] }) {
  if (lignes.length === 0) return null
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <Hourglass className="size-5 text-suivi-orange" aria-hidden />
        <h2 className="text-base font-bold">À maturité</h2>
        <span className="rounded-full bg-suivi-orange/12 px-2 py-0.5 text-xs font-bold text-suivi-orange">{lignes.length}</span>
      </div>
      <p className="px-4 text-xs text-doux">Leur date clé approche : c’est le bon moment pour reprendre contact.</p>
      <ul className="mt-1 pb-1">
        {lignes.map(({ quoi: s, dc, jours }) => (
          <li key={`${s.cle}-${dc.id}`} className="flex items-center gap-3 py-2.5 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
            <Link to={s.lien} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
              <Visuel s={s} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{s.titre}</span>
                <span className="block truncate text-xs text-doux">
                  <strong className="text-suivi-orange">{TYPES_DATE_CLE[dc.type].libelle}</strong> {quandLisible(jours)}
                  {dc.note ? ` · ${dc.note}` : ''}
                </span>
              </span>
            </Link>
            <BoutonAppel s={s} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Anniversaires (naissance, signature) des 7 prochains jours, avec un message prêt à envoyer. */
export function Anniversaires({ lignes }: { lignes: Anniversaire<Contact>[] }) {
  const { profil } = useAuth()
  const agence = useNomAgence()
  if (lignes.length === 0) return null
  const prenomAgent = profil?.nom?.split(' ')[0]
  const signature = [prenomAgent, agence].filter(Boolean).join(', ')
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <CakeSlice className="size-5 text-[#db2777]" aria-hidden />
        <h2 className="text-base font-bold">Anniversaires</h2>
      </div>
      <p className="px-4 text-xs text-doux">Un petit message fait toujours plaisir… et entretient la relation.</p>
      <ul className="mt-1 pb-1">
        {lignes.map((a) => {
          const c = a.quoi
          const texte = messageAnniversaire(a, c.prenom, signature ? `— ${signature}` : '', agence)
          const tel = !c.nePasContacter && c._telNorm[0]
          return (
            <li key={`${a.type}-${c.id}-${a.date.toISOString()}`} className="flex items-center gap-3 py-2.5 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-bord/60">
              <Link to={`/contacts/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                <Avatar initiales={initiales(c)} cle={c.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{nomAffiche(c)}</span>
                  <span className="block truncate text-xs text-doux">
                    <strong className={a.dans === 0 ? 'text-[#db2777]' : ''}>
                      {a.type === 'naissance' ? `Anniversaire${a.annees ? ` · ${a.annees} ans` : ''}` : `Signé il y a ${a.annees} an${a.annees! > 1 ? 's' : ''}`}
                    </strong>{' '}
                    · {quandLisible(a.dans)}
                  </span>
                </span>
              </Link>
              {tel && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => lancerAction(c, 'whatsapp', null, null, texte)}
                    className="presse grid size-11 place-items-center rounded-full bg-whatsapp/15 text-[#128c4b]"
                    aria-label={`Souhaiter par WhatsApp à ${nomAffiche(c)}`}
                  >
                    <MessageCircle className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => lancerAction(c, 'sms', null, null, texte)}
                    className="presse grid size-11 place-items-center rounded-full bg-primaire-doux text-primaire-texte"
                    aria-label={`Souhaiter par SMS à ${nomAffiche(c)}`}
                  >
                    <MessageSquare className="size-5" aria-hidden />
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
