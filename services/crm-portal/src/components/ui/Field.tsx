import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  optional?: boolean
  hint?: string
  error?: string
  children: ReactNode
}

export function Field({ label, optional, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-baseline gap-2 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
