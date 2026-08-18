import { FileText, Image, FileSpreadsheet, X, AlertCircle } from 'lucide-react'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { ProgressBar } from '../ui/ProgressBar'
import type { UploadedDoc } from '../../types/project'

const TAGS = ['Brand guide', 'Requirements doc', 'Reference site', 'Mockup', 'Other']

function iconFor(fileType: string) {
  if (['.png', '.jpg', '.jpeg'].includes(fileType)) return <Image size={16} />
  if (['.csv', '.xlsx'].includes(fileType)) return <FileSpreadsheet size={16} />
  return <FileText size={16} />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadedDocCardProps {
  doc: UploadedDoc
  onRemove: () => void
}

export function UploadedDocCard({ doc, onRemove }: UploadedDocCardProps) {
  const updateUploadedDoc = useCreateProjectStore((s) => s.updateUploadedDoc)

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{iconFor(doc.fileType)}</span>
        <span className="flex-1 truncate text-sm font-medium">{doc.fileName}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(doc.sizeBytes)}</span>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X size={14} />
        </button>
      </div>

      {(doc.uploadStatus === 'uploading' || doc.uploadStatus === 'processing') && (
        <div className="flex items-center gap-2">
          <ProgressBar value={doc.uploadStatus === 'processing' ? 100 : doc.progress} />
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
            {doc.uploadStatus === 'processing' ? 'Parsing…' : `${doc.progress}%`}
          </span>
        </div>
      )}

      {doc.uploadStatus === 'ready' && doc.extractionFailed && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertCircle size={12} />
          Couldn't extract text from this file — it's still saved, but the assistant won't use it as context.
        </div>
      )}

      {doc.uploadStatus === 'error' && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle size={12} />
          {doc.error ?? 'Upload failed.'}
        </div>
      )}

      {doc.uploadStatus === 'ready' && (
        <select
          value={doc.tag ?? ''}
          onChange={(e) => updateUploadedDoc(doc.id, { tag: e.target.value || undefined })}
          className="w-fit rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option value="">Tag this document…</option>
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
