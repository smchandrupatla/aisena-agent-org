import { useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { Field } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import { TagInput } from '../ui/TagInput'
import { CollapsibleSection } from '../ui/CollapsibleSection'
import { DATABASE_TYPES, SEARCH_ENGINES } from '../../lib/mockData'
import { validateEnterpriseFeatures } from '../../lib/validation'
import type { ComplianceFlag, DatabaseHosting, DatabaseType, MultiTenancyStrategy, SearchEngine } from '../../types/project'

function MicroField({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ml-6 mt-1">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">
          + {label}
        </button>
      ) : (
        <div className="max-w-xs">
          <div className="mb-1 text-xs text-muted-foreground">{label}</div>
          {children}
        </div>
      )}
    </div>
  )
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function EnterpriseFeaturesStep() {
  const type = useCreateProjectStore((s) => s.formState.type)
  const formState = useCreateProjectStore((s) => s.formState)
  const updateField = useCreateProjectStore((s) => s.updateField)
  const toggleArrayValue = useCreateProjectStore((s) => s.toggleArrayValue)
  const ef = formState.enterpriseFeatures
  const isWebsite = type === 'website'
  const { warnings } = validateEnterpriseFeatures(formState)

  const dbEnabled = ef.database?.enabled ?? false
  const searchEnabled = ef.search?.enabled ?? false
  const showMultiTenancy = type === 'portal' || ef.identityAccess.multiTenant

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold">Enterprise Features & Data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Opt into common enterprise building blocks instead of hand-configuring each one.
      </p>

      {isWebsite && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Most of these apply to logged-in apps and portals — for a marketing site, Search is usually
          all you need. Skip ahead if none of this applies.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Database</h3>
          <div className="mt-3 flex flex-col gap-3">
            <Toggle
              label="Enable a database?"
              checked={dbEnabled}
              onChange={(checked) =>
                updateField('enterpriseFeatures.database', {
                  enabled: checked,
                  type: ef.database?.type ?? 'postgresql',
                  hosting: ef.database?.hosting ?? 'managed',
                  multiTenancy: ef.database?.multiTenancy,
                })
              }
            />
            {dbEnabled && (
              <>
                <Field label="Type">
                  <select
                    value={ef.database?.type ?? 'postgresql'}
                    onChange={(e) =>
                      updateField('enterpriseFeatures.database', { ...ef.database, type: e.target.value as DatabaseType })
                    }
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {DATABASE_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Hosting">
                  <div className="grid grid-cols-3 gap-2">
                    {(['managed', 'self_hosted', 'byo_connection_string'] as DatabaseHosting[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updateField('enterpriseFeatures.database', { ...ef.database, hosting: opt })}
                        className={`rounded-md border px-2 py-2 text-xs ${
                          ef.database?.hosting === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                        }`}
                      >
                        {opt === 'managed' ? 'Managed' : opt === 'self_hosted' ? 'Self-hosted' : 'Bring-your-own conn. string'}
                      </button>
                    ))}
                  </div>
                </Field>
                {showMultiTenancy && (
                  <Field label="Multi-tenancy strategy" optional>
                    <select
                      value={ef.database?.multiTenancy ?? ''}
                      onChange={(e) =>
                        updateField('enterpriseFeatures.database', {
                          ...ef.database,
                          multiTenancy: (e.target.value || undefined) as MultiTenancyStrategy | undefined,
                        })
                      }
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="single_tenant">Single-tenant</option>
                      <option value="shared_schema">Shared schema with tenant ID</option>
                      <option value="schema_per_tenant">Schema-per-tenant</option>
                      <option value="db_per_tenant">Database-per-tenant</option>
                    </select>
                  </Field>
                )}
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Search</h3>
          <div className="mt-3 flex flex-col gap-3">
            <Toggle
              label="Enable search?"
              checked={searchEnabled}
              onChange={(checked) =>
                updateField('enterpriseFeatures.search', {
                  enabled: checked,
                  engine: ef.search?.engine ?? 'db_fulltext',
                  scope: ef.search?.scope ?? [],
                })
              }
            />
            {searchEnabled && (
              <>
                <Field label="Engine">
                  <select
                    value={ef.search?.engine ?? 'db_fulltext'}
                    onChange={(e) =>
                      updateField('enterpriseFeatures.search', { ...ef.search, engine: e.target.value as SearchEngine })
                    }
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {SEARCH_ENGINES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scope" optional hint="What should be searchable — defaults to all content if left empty">
                  <TagInput
                    value={ef.search?.scope ?? []}
                    onChange={(scope) => updateField('enterpriseFeatures.search', { ...ef.search, scope })}
                    placeholder="e.g. Documents, Tickets, Users"
                  />
                </Field>
              </>
            )}
          </div>
        </div>

        {!isWebsite && (
          <>
            <CollapsibleSection
              title="Identity & Access"
              badge={[ef.identityAccess.sso, ef.identityAccess.rbac, ef.identityAccess.mfa, ef.identityAccess.multiTenant].filter(Boolean).length}
            >
              <Checkbox label="Single Sign-On (SSO/SAML/OIDC)" checked={ef.identityAccess.sso} onChange={(v) => updateField('enterpriseFeatures.identityAccess.sso', v)} />
              <Checkbox label="Role-Based Access Control (RBAC)" checked={ef.identityAccess.rbac} onChange={(v) => updateField('enterpriseFeatures.identityAccess.rbac', v)} />
              {ef.identityAccess.rbac && (
                <MicroField label="Default roles">
                  <TagInput
                    value={ef.identityAccess.rbacDefaultRoles ?? []}
                    onChange={(roles) => updateField('enterpriseFeatures.identityAccess.rbacDefaultRoles', roles)}
                    placeholder="Admin, Editor, Viewer"
                  />
                </MicroField>
              )}
              <Checkbox label="Multi-factor authentication (MFA)" checked={ef.identityAccess.mfa} onChange={(v) => updateField('enterpriseFeatures.identityAccess.mfa', v)} />
              <Checkbox label="Multi-tenancy (isolates data per customer/org)" checked={ef.identityAccess.multiTenant} onChange={(v) => updateField('enterpriseFeatures.identityAccess.multiTenant', v)} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Data & Reliability"
              badge={[ef.dataReliability.caching, ef.dataReliability.backgroundJobs, ef.dataReliability.backupsAndDR, ef.dataReliability.rateLimiting].filter(Boolean).length}
            >
              <Checkbox label="Caching layer (e.g. Redis)" checked={ef.dataReliability.caching} onChange={(v) => updateField('enterpriseFeatures.dataReliability.caching', v)} />
              <Checkbox label="Background jobs / task queue" checked={ef.dataReliability.backgroundJobs} onChange={(v) => updateField('enterpriseFeatures.dataReliability.backgroundJobs', v)} />
              <Checkbox label="Automated backups & disaster recovery" checked={ef.dataReliability.backupsAndDR} onChange={(v) => updateField('enterpriseFeatures.dataReliability.backupsAndDR', v)} />
              <Checkbox label="Rate limiting & throttling" checked={ef.dataReliability.rateLimiting} onChange={(v) => updateField('enterpriseFeatures.dataReliability.rateLimiting', v)} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Observability & Compliance"
              badge={[ef.observabilityCompliance.auditLogging, ef.observabilityCompliance.monitoring, ef.observabilityCompliance.centralizedLogging].filter(Boolean).length + ef.observabilityCompliance.complianceFlags.length}
            >
              <Checkbox label="Audit logging (who did what, when)" checked={ef.observabilityCompliance.auditLogging} onChange={(v) => updateField('enterpriseFeatures.observabilityCompliance.auditLogging', v)} />
              <Checkbox label="Application monitoring & error tracking" checked={ef.observabilityCompliance.monitoring} onChange={(v) => updateField('enterpriseFeatures.observabilityCompliance.monitoring', v)} />
              <Checkbox label="Centralized logging" checked={ef.observabilityCompliance.centralizedLogging} onChange={(v) => updateField('enterpriseFeatures.observabilityCompliance.centralizedLogging', v)} />
              <div className="pt-1">
                <div className="mb-1 text-xs text-muted-foreground">
                  Compliance flags — informational only, doesn't auto-implement compliance
                </div>
                <div className="flex flex-wrap gap-3">
                  {(['gdpr', 'soc2', 'hipaa', 'data_residency'] as ComplianceFlag[]).map((flag) => (
                    <Checkbox
                      key={flag}
                      label={flag === 'data_residency' ? 'Data residency' : flag.toUpperCase()}
                      checked={ef.observabilityCompliance.complianceFlags.includes(flag)}
                      onChange={() => toggleArrayValue('enterpriseFeatures.observabilityCompliance.complianceFlags', flag)}
                    />
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Integration & Communication">
              <Field label="API exposure">
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'rest', 'graphql', 'both'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateField('enterpriseFeatures.integrationComms.apiExposure', opt)}
                      className={`rounded-md border px-2 py-1.5 text-xs capitalize ${
                        ef.integrationComms.apiExposure === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>
              <Checkbox label="Webhooks (outbound event notifications)" checked={ef.integrationComms.webhooks} onChange={(v) => updateField('enterpriseFeatures.integrationComms.webhooks', v)} />
              <Checkbox label="Email notifications" checked={ef.integrationComms.emailNotifications} onChange={(v) => updateField('enterpriseFeatures.integrationComms.emailNotifications', v)} />
              <Checkbox label="In-app / push notifications" checked={ef.integrationComms.pushNotifications} onChange={(v) => updateField('enterpriseFeatures.integrationComms.pushNotifications', v)} />
              <Field label="Third-party integrations" optional hint="e.g. Slack, Zapier">
                <TagInput
                  value={ef.integrationComms.thirdPartyIntegrations}
                  onChange={(tags) => updateField('enterpriseFeatures.integrationComms.thirdPartyIntegrations', tags)}
                  placeholder="Slack, Zapier…"
                />
              </Field>
            </CollapsibleSection>

            <CollapsibleSection title="Internationalization">
              <Checkbox label="Multi-language support (i18n)" checked={ef.i18n.multiLanguage} onChange={(v) => updateField('enterpriseFeatures.i18n.multiLanguage', v)} />
              <Checkbox label="Multi-currency (billing-capable portals)" checked={ef.i18n.multiCurrency} onChange={(v) => updateField('enterpriseFeatures.i18n.multiCurrency', v)} />
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  )
}
