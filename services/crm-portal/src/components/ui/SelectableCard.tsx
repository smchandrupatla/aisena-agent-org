import { type ReactNode } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'

interface SelectableCardProps {
  title: string
  description: string
  icon?: ReactNode
  selected: boolean
  onSelect: () => void
  expandedContent?: ReactNode
  disabled?: boolean
  disabledReason?: string
}

export function SelectableCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  expandedContent,
  disabled,
  disabledReason,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'group relative flex flex-col gap-2 rounded-xl border-2 p-5 text-left transition-all',
        'hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
        disabled && 'cursor-not-allowed opacity-50 hover:shadow-none',
      )}
      title={disabled ? disabledReason : undefined}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check size={14} />
        </span>
      )}
      {icon && <div className="text-primary">{icon}</div>}
      <div className="text-base font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
      {expandedContent && (
        <div className="mt-2 hidden border-t border-border pt-2 text-xs text-muted-foreground group-hover:block">
          {expandedContent}
        </div>
      )}
      {disabled && disabledReason && (
        <div className="mt-1 text-xs italic text-muted-foreground">{disabledReason}</div>
      )}
    </button>
  )
}
