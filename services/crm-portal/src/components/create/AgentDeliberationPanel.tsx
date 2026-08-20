import { useEffect, useState, useCallback } from 'react'
import { Bot, Brain, CheckCircle2, Loader2, Play, ChevronRight, Users, AlertTriangle, Clock, ArrowRight } from 'lucide-react'

interface DeliberationTask {
  id: string
  title: string
  description: string
  owner: string
  priority: string
  estimated_hours: number
  dependencies: string[]
  phase: string
  status: string
}

interface PhaseProgress {
  label: string
  agents: string[]
  total_tasks: number
  completed_tasks: number
  status: string
  started_at: string | null
  completed_at: string | null
}

interface Deliberation {
  id: string
  project: { name: string; type: string; description: string }
  status: string
  created_at: string
  phases: Record<string, any>
  plan: { tasks: DeliberationTask[]; risks: any[] }
  execution_progress: Record<string, PhaseProgress>
}

const API_BASE = 'http://localhost:5000/api'

function agentLabel(key: string): string {
  if (!key) return 'Unknown'
  const parts = key.split('-')
  parts.shift() // remove number prefix
  return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    PLANNED: 'bg-violet-100 text-violet-700',
    DONE: 'bg-emerald-100 text-emerald-700',
  }
  return map[status] || 'bg-slate-100 text-slate-600'
}

export function AgentDeliberationPanel({ deliberationId }: { deliberationId: string }) {
  const [delib, setDelib] = useState<Deliberation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['deliberate', 'specialize']))

  const fetchDeliberation = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/deliberations/${deliberationId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDelib(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [deliberationId])

  useEffect(() => { fetchDeliberation() }, [fetchDeliberation])

  async function executePhase() {
    if (!delib) return
    try {
      const res = await fetch(`${API_BASE}/deliberations/${deliberationId}/execute`, { method: 'POST' })
      if (res.ok) setDelib(await res.json())
    } catch { /* ignore */ }
  }

  async function advancePhase() {
    if (!delib) return
    try {
      const res = await fetch(`${API_BASE}/deliberations/${deliberationId}/advance`, { method: 'POST' })
      if (res.ok) setDelib(await res.json())
    } catch { /* ignore */ }
  }

  function togglePhase(phaseName: string) {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      next.has(phaseName) ? next.delete(phaseName) : next.add(phaseName)
      return next
    })
  }

  if (loading) return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 size={16} className="animate-spin" /> Loading deliberation...
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 p-6 text-sm text-destructive">
      <AlertTriangle size={16} /> Failed to load deliberation: {error}
    </div>
  )

  if (!delib) return null

  const phaseData = delib.phases
  const execProgress = delib.execution_progress
  const isExecuting = delib.status === 'IN_PROGRESS'
  const isComplete = delib.status === 'COMPLETED'
  const currentPhase = Object.values(execProgress || {}).find(p => p.status === 'IN_PROGRESS')

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Agent Deliberation</h3>
            <p className="text-[11px] text-muted-foreground">{delib.project.name}</p>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadge(delib.status)}`}>
            {delib.status.replace('_', ' ')}
          </span>
          <span className="text-muted-foreground">|</span>
          <Clock size={12} className="text-muted-foreground" />
          <span className="text-muted-foreground">{new Date(delib.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3 space-y-3">
        {/* Deliberation Phases */}
        <div className="rounded-lg border border-border">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Deliberation Rounds
          </div>

          {['deliberate', 'specialize', 'plan'].map(phaseName => {
            const phase = phaseData?.[phaseName]
            if (!phase) return null
            const isExpanded = expandedPhases.has(phaseName)
            const agentKeys = Object.keys(phase)
            const phaseLabel = phaseName === 'deliberate' ? 'Core Analysis' :
              phaseName === 'specialize' ? 'Domain Specialization' : 'Synthesis & Plan'

            return (
              <div key={phaseName} className="border-t border-border">
                <button
                  type="button"
                  onClick={() => togglePhase(phaseName)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="text-sm font-medium">{phaseLabel}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {agentKeys.length} agent{agentKeys.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {agentKeys.map(key => {
                      const output = phase[key]
                      const summary = typeof output === 'object' && output !== null
                        ? (output as any).summary || '(no summary)'
                        : ''
                      return (
                        <div key={key} className="rounded-md bg-accent/50 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Bot size={12} className="text-primary" />
                            <span className="text-xs font-medium">{agentLabel(key)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Task Plan */}
        {delib.plan?.tasks?.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Task Plan ({delib.plan.tasks.length} tasks)
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {delib.plan.tasks.slice(0, 20).map(task => (
                <div key={task.id} className="border-t border-border px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{task.id}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusBadge(task.status)}`}>
                          {task.status}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                          task.priority === 'high' ? 'bg-red-100 text-red-700' :
                          task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs font-medium mt-0.5 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Bot size={10} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{agentLabel(task.owner)}</span>
                        <span className="text-[10px] text-muted-foreground">· {task.estimated_hours}h</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Execution Progress */}
        {execProgress && Object.keys(execProgress).length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Execution Progress
            </div>
            {Object.entries(execProgress).map(([phaseId, phase]) => (
              <div key={phaseId} className="border-t border-border px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {phase.status === 'COMPLETED' ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : phase.status === 'IN_PROGRESS' ? (
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" />
                    )}
                    <span className="text-xs font-medium">{phase.label}</span>
                  </div>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusBadge(phase.status)}`}>
                    {phase.status.replace('_', ' ')}
                  </span>
                </div>
                {phase.total_tasks > 0 && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{phase.completed_tasks}/{phase.total_tasks} tasks</span>
                      <span>{Math.round((phase.completed_tasks / phase.total_tasks) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(phase.completed_tasks / phase.total_tasks) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  <Users size={10} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {phase.agents.map(a => agentLabel(a)).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Risks */}
        {delib.plan?.risks?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50">
            <div className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle size={12} /> Risks ({delib.plan.risks.length})
            </div>
            {delib.plan.risks.slice(0, 5).map((risk: any, i: number) => (
              <div key={i} className="border-t border-amber-200 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                    risk.severity === 'high' ? 'bg-red-100 text-red-700' :
                    risk.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {risk.severity}
                  </span>
                  <span className="text-xs font-medium">{risk.risk}</span>
                </div>
                {risk.mitigation && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">
                    Mitigation: {risk.mitigation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border p-3">
        {!isExecuting && !isComplete && (
          <button
            type="button"
            onClick={executePhase}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Play size={14} /> Start Execution
          </button>
        )}
        {isExecuting && currentPhase && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Running: {currentPhase.label}
            </div>
            <button
              type="button"
              onClick={advancePhase}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <ArrowRight size={14} /> Advance to Next Phase
            </button>
          </div>
        )}
        {isComplete && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 size={16} /> All phases complete
          </div>
        )}
        <button
          type="button"
          onClick={fetchDeliberation}
          className="flex w-full items-center justify-center gap-2 mt-2 rounded-md border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}