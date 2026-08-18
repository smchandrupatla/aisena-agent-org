import { useEffect, useState } from 'react'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { Field } from '../ui/Field'
import { slugify } from '../../lib/slug'
import { OWNERS } from '../../lib/mockData'
import { DocumentUploadZone } from './DocumentUploadZone'
import type { Visibility } from '../../types/project'

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only you can access it' },
  { value: 'team', label: 'Team', hint: 'Visible to your team/workspace' },
  { value: 'public', label: 'Public', hint: 'Anyone with the link can view' },
]

export function BasicsStep() {
  const formState = useCreateProjectStore((s) => s.formState)
  const updateField = useCreateProjectStore((s) => s.updateField)
  const checkNameUniqueness = useCreateProjectStore((s) => s.checkNameUniqueness)
  const nameUniqueStatus = useCreateProjectStore((s) => s.nameUniqueStatus)
  const nameSuggestion = useCreateProjectStore((s) => s.nameSuggestion)
  const [localName, setLocalName] = useState(formState.name)

  useEffect(() => {
    if (!localName.trim()) return
    const handle = setTimeout(() => checkNameUniqueness(localName), 400)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localName])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Basics</h2>
        <p className="mt-1 text-sm text-muted-foreground">Common details for every project type.</p>
      </div>

      <Field label="Name" error={nameUniqueStatus === 'duplicate' ? `Already taken — try "${nameSuggestion}"` : undefined}>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            updateField('name', e.target.value)
          }}
          placeholder="e.g. Customer Support Portal"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>slug: {slugify(localName) || '—'}</span>
          {nameUniqueStatus === 'checking' && <span>· checking availability…</span>}
          {nameUniqueStatus === 'unique' && <span className="text-emerald-600">· available</span>}
        </div>
      </Field>

      <Field label="Description" optional>
        <textarea
          value={formState.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          placeholder="A short purpose statement for this project."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>

      <Field label="Owner/Team">
        <select
          value={formState.ownerId}
          onChange={(e) => updateField('ownerId', e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {OWNERS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Visibility" hint="Mainly relevant for Portal and Web App">
        <div className="grid grid-cols-3 gap-2">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('visibility', opt.value)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                formState.visibility === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.hint}</div>
            </button>
          ))}
        </div>
      </Field>

      <div className="border-t border-border pt-6">
        <h3 className="mb-2 text-sm font-semibold">Reference documents</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Upload briefs, specs, brand guidelines, or screenshots — the AI assistant will use these as
          context. You can also manage uploads anytime from the sidebar panel.
        </p>
        <DocumentUploadZone compact />
      </div>
    </div>
  )
}
