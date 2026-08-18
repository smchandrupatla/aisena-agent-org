import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

interface CollapsibleSectionProps {
  title: string
  subtitle?: string
  badge?: number
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({ title, subtitle, badge, defaultOpen, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {!!badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {badge} selected
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {subtitle}
          <ChevronDown size={16} className={clsx('transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <div className="space-y-3 border-t border-border px-4 py-4">{children}</div>}
    </div>
  )
}
