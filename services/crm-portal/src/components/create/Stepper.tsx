import clsx from 'clsx'
import { Check } from 'lucide-react'
import { STEP_LABELS } from '../../store/createProjectStore'

interface StepperProps {
  current: number
  furthestReached: number
  onJump: (index: number) => void
}

export function Stepper({ current, furthestReached, onJump }: StepperProps) {
  return (
    <div className="w-full border-b border-border bg-card px-6 py-4">
      <ol className="flex items-center gap-2">
        {STEP_LABELS.map((label, index) => {
          const isDone = index < current
          const isCurrent = index === current
          const reachable = index <= furthestReached
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onJump(index)}
                className={clsx(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  isCurrent && 'bg-primary text-primary-foreground',
                  !isCurrent && isDone && 'bg-primary/10 text-primary hover:bg-primary/20',
                  !isCurrent && !isDone && reachable && 'bg-muted text-muted-foreground hover:bg-accent',
                  !reachable && 'cursor-not-allowed bg-muted text-muted-foreground/50',
                )}
              >
                <span
                  className={clsx(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                    isCurrent ? 'bg-primary-foreground text-primary' : 'bg-background',
                  )}
                >
                  {isDone ? <Check size={12} /> : index + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {index < STEP_LABELS.length - 1 && (
                <div className={clsx('h-px flex-1', isDone ? 'bg-primary' : 'bg-border')} />
              )}
            </li>
          )
        })}
      </ol>
      <div className="mt-2 text-xs text-muted-foreground">
        Step {current + 1} of {STEP_LABELS.length}
      </div>
    </div>
  )
}
