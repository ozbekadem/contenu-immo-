import { db } from '@/data/db'
import { SOURCES_CONTACT, STATUTS_CONTACT, TYPES_EVENEMENT, type Contact } from '@/data/types'
import { LIBELLE_CONSENTEMENT } from '@/domain/communication'
import { versCsv } from '@/domain/importation'
import { LIBELLE_STATUT } from '@/domain/prospection'
import { LIBELLE_TEMPERATURE } from '@/domain/relance'
import { RESULTATS } from '@/domain/resultats'
import { nomAffiche } from '@/features/contacts/affichage'
import { adresseCourte } from '@/features/prospection/affichage'

type Cellule = string | number | Date | null
type Feuille = { nom: string; lignes: Cellule[][] }

const date = (iso: string | null | undefined) => (iso ? new Date(iso) : null)
const libelleStatut = (s: string) => STATUTS_CONTACT.find((x) => x.code === s)?.libelle ?? s
const libelleSource = (s: string | null | undefined) => (s ? (SOURCES_CONTACT.find((x) => x.code === s)?.libelle.replace(/ \(.*\)/, '') ?? s) : '')
const consentement = (c: Contact, canal: 'sms' | 'whatsapp' | 'email') => {
  const x = c.consentements?.[canal]
  return x ? `${LIBELLE_CONSENTEMENT[x.etat]} (${x.date})` : ''
}

export async function feuilleContacts(): Promise<Feuille> {
  const contacts = (await db.contacts.orderBy('_tri').toArray()).filter((c) => !c.archivedAt)
  return {
    nom: 'Contacts',
    lignes: [
      ['Civilité', 'Prénom', 'Nom', 'Société', 'Téléphone', 'Téléphone 2', 'Email', 'Rue', 'Numéro', 'Boîte', 'Code postal', 'Localité', 'Statut', 'Origine', 'Température', 'Dernier contact', 'Prochaine relance', 'Date de naissance', 'Ne plus contacter', 'Accord SMS', 'Accord WhatsApp', 'Accord email', 'Étiquettes', 'Notes', 'Créé le'],
      ...contacts.map((c) => [
        c.civilite,
        c.prenom,
        c.nom,
        c.societe,
        c.telephones[0]?.numero ?? '',
        c.telephones.slice(1).map((t) => t.numero).join(' / '),
        c.emails.join(', '),
        c.adresse?.rue ?? '',
        c.adresse?.numero ?? '',
        c.adresse?.boite ?? '',
        c.adresse?.cp ?? '',
        c.adresse?.ville ?? '',
        c.statuts.map(libelleStatut).join(', '),
        libelleSource(c.source),
        c.temperature ? LIBELLE_TEMPERATURE[c.temperature] : '',
        date(c.dernierContactAt),
        date(c.prochaineRelanceAt),
        c.dateNaissance ?? '',
        c.nePasContacter ? 'Oui' : '',
        consentement(c, 'sms'),
        consentement(c, 'whatsapp'),
        consentement(c, 'email'),
        c.tags.join(', '),
        c.notes,
        date(c.createdAt),
      ]),
    ],
  }
}

async function autresFeuilles(): Promise<Feuille[]> {
  const [pistes, biens, contacts, interactions, evenements] = await Promise.all([db.pistes.toArray(), db.biens.toArray(), db.contacts.toArray(), db.interactions.toArray(), db.evenements.toArray()])
  const bien = new Map(biens.map((b) => [b.id, b]))
  const contact = new Map(contacts.map((c) => [c.id, c]))
  return [
    {
      nom: 'Pistes',
      lignes: [
        ['Catégorie', 'Adresse', 'Code postal', 'Étape', 'Origine', 'Lien de l’annonce', 'Prix', 'Propriétaire', 'Téléphone', 'Dernier contact', 'Prochaine relance', 'Repéré le', 'Notes'],
        ...pistes
          .filter((p) => !p.archivedAt)
          .map((p) => {
            const b = bien.get(p.bienId)
            const c = p.contactId ? contact.get(p.contactId) : undefined
            return [
              p.categorie === 'annonce' ? 'Annonce' : 'Maison vide',
              b ? adresseCourte(b) : '',
              b?.adresse?.cp ?? '',
              LIBELLE_STATUT[p.statut],
              libelleSource(p.source),
              p.sourceUrl ?? '',
              p.prix,
              c ? nomAffiche(c) : '',
              c?.telephones[0]?.numero ?? '',
              date(p.dernierContactAt),
              date(p.prochaineRelanceAt),
              date(p.createdAt),
              p.notes,
            ]
          }),
      ],
    },
    {
      nom: 'Historique',
      lignes: [
        ['Date', 'Contact', 'Canal', 'Résultat', 'Commentaire'],
        ...interactions
          .filter((i) => !i.archivedAt)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((i) => {
            const c = i.contactId ? contact.get(i.contactId) : undefined
            return [date(i.date), c ? nomAffiche(c) : '', i.type, RESULTATS[i.resultat]?.libelle ?? i.resultat, i.commentaire]
          }),
      ],
    },
    {
      nom: 'Rendez-vous',
      lignes: [
        ['Début', 'Fin', 'Type', 'Titre', 'Contact', 'Lieu', 'Notes'],
        ...evenements
          .filter((e) => !e.archivedAt)
          .sort((a, b) => b.debut.localeCompare(a.debut))
          .map((e) => {
            const c = e.contactId ? contact.get(e.contactId) : undefined
            return [date(e.debut), date(e.fin), TYPES_EVENEMENT.find((t) => t.code === e.type)?.libelle ?? e.type, e.titre, c ? nomAffiche(c) : '', e.lieu, e.notes]
          }),
      ],
    },
  ]
}

export function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export const aujourdhui = () => new Date().toISOString().slice(0, 10)

/** Excel (.xlsx) : contacts seuls, ou tout (contacts, pistes, historique, rendez-vous) sur plusieurs onglets. */
export async function exporterExcel(tout: boolean): Promise<void> {
  const { default: ecrire } = await import('write-excel-file/browser')
  const feuilles = [await feuilleContacts(), ...(tout ? await autresFeuilles() : [])]
  const sheets = feuilles.map((f) => ({
    sheet: f.nom,
    stickyRowsCount: 1,
    dateFormat: 'dd/mm/yyyy hh:mm',
    columns: f.lignes[0]!.map((t) => ({ width: Math.min(Math.max(String(t).length + 4, 12), 40) })),
    data: f.lignes.map((l, i) =>
      l.map((v) => (i === 0 ? { value: String(v), fontWeight: 'bold' as const } : v === null || v === '' ? null : v instanceof Date ? { value: v, type: Date, format: 'dd/mm/yyyy hh:mm' } : { value: v })),
    ),
  }))
  const blob = await ecrire(sheets as never).toBlob()
  telecharger(blob, `linkimmo-${tout ? 'export-complet' : 'contacts'}-${aujourdhui()}.xlsx`)
}

/** CSV des contacts (s'ouvre dans Excel, Google Sheets, ou s'importe ailleurs). */
export async function exporterCsv(): Promise<void> {
  const f = await feuilleContacts()
  const texte = versCsv(f.lignes.map((l) => l.map((v) => (v instanceof Date ? v.toLocaleString('fr-BE') : v))))
  telecharger(new Blob([texte], { type: 'text/csv;charset=utf-8' }), `linkimmo-contacts-${aujourdhui()}.csv`)
}
