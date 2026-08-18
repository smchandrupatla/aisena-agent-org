import { Field } from '../../ui/Field'
import { Toggle } from '../../ui/Toggle'
import { WEB_APP_FRAMEWORKS, WEB_APP_TEMPLATES, AUTH_PROVIDERS } from '../../../lib/mockData'
import type { WebAppConfig } from '../../../types/project'
import type { ConfigFormProps } from './types'

export function WebAppConfigForm({ value, onChange }: ConfigFormProps<WebAppConfig>) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Framework">
        <select
          value={value.framework ?? 'React'}
          onChange={(e) => onChange({ framework: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {WEB_APP_FRAMEWORKS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Auth required?">
        <Toggle
          checked={Boolean(value.authRequired)}
          onChange={(checked) => onChange({ authRequired: checked, authProvider: checked ? value.authProvider ?? AUTH_PROVIDERS[0] : undefined })}
          description="Users must sign in before using this app"
        />
      </Field>

      {value.authRequired && (
        <Field label="Auth provider">
          <select
            value={value.authProvider ?? AUTH_PROVIDERS[0]}
            onChange={(e) => onChange({ authProvider: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {AUTH_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Data layer">
        <div className="grid grid-cols-3 gap-2">
          {(['none', 'database', 'api'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ dataLayer: opt })}
              className={`rounded-md border px-3 py-2 text-sm capitalize ${
                value.dataLayer === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              {opt === 'none' ? 'None' : opt === 'database' ? 'Database' : 'API-backed'}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Starting template">
        <select
          value={value.template ?? 'Blank'}
          onChange={(e) => onChange({ template: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {WEB_APP_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}
