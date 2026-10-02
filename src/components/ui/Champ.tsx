import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type ComponentProps } from 'react'

export const classeSaisie =
  'h-12 w-full rounded-2xl border border-transparent bg-surface-2 px-4 text-base outline-none transition placeholder:text-doux/70 focus:border-primaire focus:bg-surface focus:ring-4 focus:ring-primaire/15'

/**
 * Libellé + champ. Le libellé est relié au champ par son identifiant (et l'aide par
 * aria-describedby) : les lecteurs d'écran annoncent exactement « Rue », « Localité »…
 * Si l'enfant n'est pas un champ unique (groupe de champs), le libellé l'englobe.
 */
export function Champ({ libelle, children, aide }: { libelle: string; children: ReactNode; aide?: ReactNode }) {
  const id = useId()
  const champUnique = isValidElement(children) && [Saisie, Zone, Liste].includes(children.type as never)
  if (!champUnique)
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-doux">{libelle}</span>
        {children}
        {aide && <span className="text-xs text-doux">{aide}</span>}
      </label>
    )
  const enfant = children as ReactElement<{ id?: string; 'aria-describedby'?: string }>
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-doux">
        {libelle}
      </label>
      {cloneElement(enfant, { id, 'aria-describedby': aide ? `${id}-aide` : undefined })}
      {aide && (
        <span id={`${id}-aide`} className="text-xs text-doux">
          {aide}
        </span>
      )}
    </div>
  )
}

export function Saisie(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${classeSaisie} ${props.className ?? ''}`} />
}

export function Zone(props: ComponentProps<'textarea'>) {
  return <textarea rows={4} {...props} className={`${classeSaisie} h-auto py-3 ${props.className ?? ''}`} />
}

export function Liste(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${classeSaisie} ${props.className ?? ''}`} />
}

/** Pastille cliquable (choix multiple ou unique). */
export function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`presse h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
        actif ? 'degrade text-white shadow-primaire' : 'bg-surface text-doux ring-1 ring-bord'
      }`}
    >
      {children}
    </button>
  )
}
