import { AlertTriangle, Loader2 } from 'lucide-react'

interface NavButtonsProps {
  canGoBack: boolean
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  errors: string[]
  warnings: string[]
  submitting?: boolean
}

export function NavButtons({
  canGoBack,
  onBack,
  onNext,
  nextLabel = 'Next',
  errors,
  warnings,
  submitting,
}: NavButtonsProps) {
  return (
    <div className="border-t border-border bg-card px-6 py-4">
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-3 space-y-1.5">
          {errors.map((e) => (
            <div key={e} className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {e}
            </div>
          ))}
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 text-xs text-amber-600">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack || submitting}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={errors.length > 0 || submitting}
          className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
