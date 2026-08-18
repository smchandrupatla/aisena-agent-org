import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, CheckCircle2 } from 'lucide-react'

export function DashboardPage() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (state?.toast) {
      setToast(state.toast)
      const handle = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(handle)
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
