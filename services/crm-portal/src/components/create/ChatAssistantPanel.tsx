import { useEffect, useRef, useState } from 'react'
import { Send, Undo2, Loader2, Bot, User, AlertCircle } from 'lucide-react'
import { useCreateProjectStore } from '../../store/createProjectStore'

function FieldChip({ label, value }: { label: string; value: unknown }) {
  const display = Array.isArray(value) ? value.join(', ') : String(value)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      ✓ Updated: {label} → {display || '—'}
    </span>
  )
}

export function ChatAssistantPanel() {
  const messages = useCreateProjectStore((s) => s.chatMessages)
  const sendChatMessage = useCreateProjectStore((s) => s.sendChatMessage)
  const assistantLoading = useCreateProjectStore((s) => s.assistantLoading)
  const lastAppliedBatch = useCreateProjectStore((s) => s.lastAppliedBatch)
  const undoLastBatch = useCreateProjectStore((s) => s.undoLastBatch)
  const resolveConflict = useCreateProjectStore((s) => s.resolveConflict)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, assistantLoading])

  function handleSend() {
    const text = draft.trim()
    if (!text || assistantLoading) return
    setDraft('')
    sendChatMessage(text)
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
            </div>
            <div className={`flex max-w-[85%] flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : m.isError
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted'
                }`}
              >
                {m.isError && <AlertCircle size={13} className="mr-1 mb-0.5 inline" />}
                {m.content}
                {m.reverted && <div className="mt-1 text-[11px] italic opacity-70">(reverted)</div>}
              </div>

              {!m.reverted && m.appliedUpdates && m.appliedUpdates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.appliedUpdates.map((u) => (
                    <FieldChip key={u.path} label={u.label} value={u.value} />
                  ))}
                </div>
              )}

              {m.pendingConflicts && m.pendingConflicts.filter((c) => !c.resolved).length > 0 && (
                <div className="flex w-full flex-col gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2">
                  <div className="text-[11px] font-medium text-amber-700">
                    You already set these manually — apply the AI suggestion anyway?
                  </div>
                  {m.pendingConflicts
                    .filter((c) => !c.resolved)
                    .map((c) => (
                      <div key={c.path} className="flex items-center justify-between gap-2 text-xs">
                        <span>
                          {c.label}: <span className="line-through opacity-60">{String(c.oldValue)}</span> →{' '}
                          {String(c.newValue)}
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => resolveConflict(m.id, c.path, true)}
                            className="rounded bg-primary px-2 py-0.5 text-primary-foreground"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => resolveConflict(m.id, c.path, false)}
                            className="rounded border border-border px-2 py-0.5"
                          >
                            Keep mine
                          </button>
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {m.followUpQuestions?.map((q) => (
                <div key={q} className="rounded-md bg-accent px-2.5 py-1.5 text-xs italic">
                  {q}
                </div>
              ))}
            </div>
          </div>
        ))}

        {assistantLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" /> Assistant is thinking…
          </div>
        )}
      </div>

      {lastAppliedBatch && (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={undoLastBatch}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Undo2 size={13} /> Undo last AI update
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          rows={2}
          placeholder="Describe what you want to build, or ask what a field means…"
          className="flex-1 resize-none rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || assistantLoading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
