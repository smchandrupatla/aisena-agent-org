import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, CheckCircle2, Brain } from 'lucide-react'
import { AgentDeliberationPanel } from '../components/create/AgentDeliberationPanel'

export function DashboardPage() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)
  const [deliberationId, setDeliberationId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { toast?: string; deliberationId?: string; projectName?: string } | null
    if (state?.toast) {
      setToast(state.toast)
      const handle = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(handle)
    }
    if (state?.deliberationId) {
      setDeliberationId(state.deliberationId)
      setProjectName(state.projectName || null)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="text-lg font-semibold">AISENA Portal</div>
        <Link
          to="/create"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} /> New
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
              {deliberationId ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Brain size={20} className="text-primary" />
                    <div>
                      <h1 className="text-2xl font-semibold">Agent Collaboration</h1>
                      <p className="text-sm text-muted-foreground">
                        {projectName ? `Deliberation for "${projectName}" is in progress` : 'Agents are analyzing your project'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <AgentDeliberationPanel deliberationId={deliberationId} />
                  </div>
                  <Link
                    to="/create"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
                  >
                    <Plus size={14} /> Create Another Project
                  </Link>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold">Your projects</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a Web App, Website, or Portal in one guided flow.
                  </p>
                  <Link
                    to="/create"
                    className="mt-6 flex max-w-sm flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary hover:bg-primary/5"
                  >
                    <Plus size={24} className="text-primary" />
                    <span className="text-sm font-medium">Create a new project</span>
                  </Link>
                </>
              )}
            </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
