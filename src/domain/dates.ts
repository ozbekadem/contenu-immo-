const MS_JOUR = 86_400_000

/** Minuit (heure locale) du jour de la date donnée. */
export function debutJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Nombre de jours calendaires entre deux dates (b - a), indépendant de l'heure. */
export function ecartJours(a: Date, b: Date): number {
  // Math.round absorbe les passages heure d'été / heure d'hiver.
  return Math.round((debutJour(b).getTime() - debutJour(a).getTime()) / MS_JOUR)
}

export function ajouterJours(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Ajoute des mois en restant sur le dernier jour du mois si besoin (31 janv. + 1 mois = 28/29 févr.). */
export function ajouterMois(d: Date, n: number): Date {
  const r = new Date(d)
  const jour = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  const dernier = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(jour, dernier))
  return r
}

/** ISO → « AAAA-MM-JJ » (date locale, pour les champs date). */
export function versDateLocale(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** « AAAA-MM-JJ » → ISO à l'heure indiquée (9 h par défaut, heure de début des appels). */
export function depuisDateLocale(jour: string, heure = 9): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), heure).toISOString()
}
