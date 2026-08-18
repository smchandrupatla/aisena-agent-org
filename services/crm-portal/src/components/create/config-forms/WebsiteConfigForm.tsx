import { Field } from '../../ui/Field'
import { TagInput } from '../../ui/TagInput'
import { WEBSITE_DEFAULT_PAGES } from '../../../lib/mockData'
import type { WebsiteConfig } from '../../../types/project'
import type { ConfigFormProps } from './types'

const SITE_TYPES: { value: WebsiteConfig['siteType']; label: string }[] = [
  { value: 'landing', label: 'Landing page' },
  { value: 'multipage', label: 'Multi-page marketing site' },
  { value: 'blog', label: 'Blog' },
]

export function WebsiteConfigForm({ value, onChange }: ConfigFormProps<WebsiteConfig>) {
  const pages = value.pages ?? []
  const customPages = pages.filter((p) => !WEBSITE_DEFAULT_PAGES.includes(p))

  function togglePage(page: string) {
    const next = pages.includes(page) ? pages.filter((p) => p !== page) : [...pages, page]
    onChange({ pages: next })
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Site type">
        <div className="grid grid-cols-3 gap-2">
          {SITE_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ siteType: opt.value })}
              className={`rounded-md border px-3 py-2 text-sm ${
                value.siteType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Initial pages">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WEBSITE_DEFAULT_PAGES.map((page) => (
            <label key={page} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pages.includes(page)} onChange={() => togglePage(page)} />
              {page}
            </label>
          ))}
        </div>
        <TagInput
          value={customPages}
          onChange={(tags) => onChange({ pages: [...pages.filter((p) => WEBSITE_DEFAULT_PAGES.includes(p)), ...tags] })}
          placeholder="Add a custom page name…"
        />
      </Field>

      <Field label="Domain" optional hint="Custom domain, or leave blank for a subdomain default">
        <input
          value={value.domain ?? ''}
          onChange={(e) => onChange({ domain: e.target.value })}
          placeholder="example.com"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>

      <Field label="SEO basics" optional hint="Editable later">
        <div className="flex flex-col gap-2">
          <input
            value={value.seo?.title ?? ''}
            onChange={(e) => onChange({ seo: { ...value.seo, title: e.target.value } })}
            placeholder="Title tag"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={value.seo?.description ?? ''}
            onChange={(e) => onChange({ seo: { ...value.seo, description: e.target.value } })}
            placeholder="Meta description"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </Field>
    </div>
  )
}
