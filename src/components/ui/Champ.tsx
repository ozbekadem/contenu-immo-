import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const classeSaisie =
  'h-12 w-full rounded-2xl border border-transparent bg-surface-2 px-4 text-base outline-none transition placeholder:text-doux/70 focus:border-primaire focus:bg-surface focus:ring-4 focus:ring-primaire/15'

export function Champ({ libelle, children, aide }: { libelle: string; children: ReactNode; aide?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-doux">{libelle}</span>
      {children}
      {aide && <span className="text-xs text-doux">{aide}</span>}
    </label>
  )
}

export function Saisie(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${classeSaisie} ${props.className ?? ''}`} />
}

export function Zone(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
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
