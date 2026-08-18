import { Field } from '../../ui/Field'
import { PORTAL_MODULES } from '../../../lib/mockData'
import type { PortalConfig } from '../../../types/project'
import type { ConfigFormProps } from './types'

const AUDIENCES: { value: PortalConfig['audience']; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'partner', label: 'Partner' },
  { value: 'internal', label: 'Internal' },
  { value: 'vendor', label: 'Vendor' },
]

const ACCESS_CONTROLS: { value: PortalConfig['accessControl']; label: string }[] = [
  { value: 'invite', label: 'Invite-only' },
  { value: 'domain', label: 'Domain-restricted' },
  { value: 'public_login', label: 'Public with login' },
]

export function PortalConfigForm({ value, onChange }: ConfigFormProps<PortalConfig>) {
  const modules = value.modules ?? []

  function toggleModule(m: string) {
    const next = modules.includes(m) ? modules.filter((x) => x !== m) : [...modules, m]
    onChange({ modules: next })
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Audience">
        <select
          value={value.audience ?? 'customer'}
          onChange={(e) => onChange({ audience: e.target.value as PortalConfig['audience'] })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Access control">
        <div className="grid grid-cols-3 gap-2">
          {ACCESS_CONTROLS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ accessControl: opt.value })}
              className={`rounded-md border px-3 py-2 text-sm ${
                value.accessControl === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Modules to include">
        <div className="grid grid-cols-2 gap-2">
          {PORTAL_MODULES.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={modules.includes(m)} onChange={() => toggleModule(m)} />
              {m}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Branding" optional>
        <div className="flex items-center gap-4">
          <label className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onChange({ branding: { ...value.branding, logoUrl: URL.createObjectURL(file) } })
              }}
            />
            {value.branding?.logoUrl ? 'Logo uploaded ✓' : 'Upload logo'}
          </label>
          <input
            type="color"
            value={value.branding?.primaryColor ?? '#2563eb'}
            onChange={(e) => onChange({ branding: { ...value.branding, primaryColor: e.target.value } })}
            className="h-10 w-14 rounded-md border border-input"
          />
        </div>
      </Field>
    </div>
  )
}
