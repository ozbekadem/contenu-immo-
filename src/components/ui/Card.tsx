import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface p-4 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord ${className}`}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}
