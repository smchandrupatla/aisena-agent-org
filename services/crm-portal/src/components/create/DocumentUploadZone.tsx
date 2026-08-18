import { useRef, useState, type DragEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import clsx from 'clsx'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { ACCEPTED_UPLOAD_TYPES, MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES } from '../../lib/mockData'
import { UploadedDocCard } from './UploadedDocCard'
import type { UploadedDoc } from '../../types/project'

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Simulates upload -> parse/extract pipeline. In production, upload goes to
// object storage first, then a separate async job extracts text and PATCHes
// the doc record — this never blocks the rest of the form.
function simulateUploadAndExtract(
  doc: UploadedDoc,
  update: (id: string, patch: Partial<UploadedDoc>) => void,
) {
  let progress = 0
  const interval = setInterval(() => {
    progress += 20
    if (progress >= 100) {
      clearInterval(interval)
      update(doc.id, { progress: 100, uploadStatus: 'processing' })
      setTimeout(() => {
        const isImage = ['.png', '.jpg', '.jpeg'].includes(extensionOf(doc.fileName))
        if (isImage) {
          update(doc.id, { uploadStatus: 'ready', extractionFailed: true })
        } else {
          update(doc.id, {
            uploadStatus: 'ready',
            extractedText: `Extracted summary of ${doc.fileName}: key requirements and notes go here (truncated for prompt context).`.slice(
              0,
              500,
            ),
          })
        }
      }, 900)
    } else {
      update(doc.id, { progress })
    }
  }, 250)
}

interface DocumentUploadZoneProps {
  compact?: boolean
}

export function DocumentUploadZone({ compact }: DocumentUploadZoneProps) {
  const uploadedDocs = useCreateProjectStore((s) => s.uploadedDocs)
  const addUploadedDoc = useCreateProjectStore((s) => s.addUploadedDoc)
  const updateUploadedDoc = useCreateProjectStore((s) => s.updateUploadedDoc)
  const removeUploadedDoc = useCreateProjectStore((s) => s.removeUploadedDoc)
  const [dragging, setDragging] = useState(false)
  const [rejections, setRejections] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const totalUsed = uploadedDocs.reduce((sum, d) => sum + d.sizeBytes, 0)
  const remaining = MAX_TOTAL_SIZE_BYTES - totalUsed

  function handleFiles(files: FileList | null) {
    if (!files) return
    const newRejections: string[] = []
    Array.from(files).forEach((file) => {
      const ext = extensionOf(file.name)
      if (!ACCEPTED_UPLOAD_TYPES.includes(ext)) {
        newRejections.push(`${file.name}: unsupported file type (${ext || 'unknown'}).`)
        return
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        newRejections.push(`${file.name}: exceeds the 25MB per-file limit.`)
        return
      }
      if (totalUsed + file.size > MAX_TOTAL_SIZE_BYTES) {
        newRejections.push(`${file.name}: would exceed the 100MB total upload quota.`)
        return
      }
      const doc: UploadedDoc = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        fileType: ext,
        sizeBytes: file.size,
        uploadStatus: 'uploading',
        progress: 0,
      }
      addUploadedDoc(doc)
      simulateUploadAndExtract(doc, updateUploadedDoc)
    })
    setRejections(newRejections)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors',
          compact ? 'p-4' : 'p-8',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
        )}
      >
        <UploadCloud size={compact ? 20 : 28} className="text-muted-foreground" />
        <div className="text-sm">
          {dragging ? 'Drop files to upload' : 'Drag & drop files, or click to browse'}
        </div>
        <div className="text-xs text-muted-foreground">
          PDF, DOCX, TXT, MD, PNG/JPG, CSV/XLSX · up to 25MB each · {formatBytes(remaining)} remaining of 100MB
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_TYPES.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {rejections.length > 0 && (
        <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {rejections.map((r) => (
            <div key={r}>{r}</div>
          ))}
        </div>
      )}

      {uploadedDocs.length > 0 && (
        <div className="flex flex-col gap-2">
          {uploadedDocs.map((doc) => (
            <UploadedDocCard key={doc.id} doc={doc} onRemove={() => removeUploadedDoc(doc.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
