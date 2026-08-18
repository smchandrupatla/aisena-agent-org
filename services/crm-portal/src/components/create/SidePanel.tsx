import { useState } from 'react'
import { MessageSquare, FolderOpen, X } from 'lucide-react'
import clsx from 'clsx'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { ChatAssistantPanel } from './ChatAssistantPanel'
import { DocumentUploadZone } from './DocumentUploadZone'

export function SidePanel() {
  const chatOpen = useCreateProjectStore((s) => s.chatOpen)
  const setChatOpen = useCreateProjectStore((s) => s.setChatOpen)
  const [tab, setTab] = useState<'assistant' | 'documents'>('assistant')

  if (!chatOpen) {
    return (
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg"
      >
        <MessageSquare size={16} /> AI Assistant
      </button>
    )
  }

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('assistant')}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium',
              tab === 'assistant' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <MessageSquare size={13} /> Assistant
          </button>
          <button
            type="button"
            onClick={() => setTab('documents')}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium',
              tab === 'documents' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <FolderOpen size={13} /> Documents
          </button>
        </div>
        <button type="button" onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'assistant' ? (
          <ChatAssistantPanel />
        ) : (
          <div className="scrollbar-thin h-full overflow-y-auto p-3">
            <DocumentUploadZone />
          </div>
        )}
      </div>
    </aside>
  )
}
