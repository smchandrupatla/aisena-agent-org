interface ProgressBarProps {
  value: number
  variant?: 'default' | 'error'
}

export function ProgressBar({ value, variant = 'default' }: ProgressBarProps) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${variant === 'error' ? 'bg-destructive' : 'bg-primary'}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
