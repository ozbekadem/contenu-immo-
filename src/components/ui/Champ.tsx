import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const classeSaisie =
  'h-12 w-full rounded-xl border border-bord bg-surface px-3 text-base outline-none transition-colors placeholder:text-doux/70 focus:border-texte'

export function Champ({ libelle, children, aide }: { libelle: string; children: ReactNode; aide?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{libelle}</span>
      {children}
      {aide && <span className="text-xs text-doux">{aide}</span>}
    </label>
  )
}

export function Saisie(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${classeSaisie} ${props.className ?? ''}`} />
}

export function Zone(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`${classeSaisie} h-auto py-2.5 ${props.className ?? ''}`} />
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
      className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
        actif ? 'border-ink bg-ink text-accent dark:border-accent dark:bg-accent dark:text-accent-ink' : 'border-bord bg-surface text-doux'
      }`}
    >
      {children}
    </button>
  )
}
