import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, Pencil } from 'lucide-react'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { submitProject } from '../../lib/createProjectApi'

const TYPE_LABEL: Record<string, string> = { web_app: 'Web App', website: 'Website', portal: 'Portal' }

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function SummaryGroup({ title, stepIndex, onEdit, children }: { title: string; stepIndex?: number; onEdit?: (i: number) => void; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {stepIndex !== undefined && onEdit && (
          <button type="button" onClick={() => onEdit(stepIndex)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      <div className="mt-2 divide-y divide-border/60">{children}</div>
    </div>
  )
}

export function ReviewStep() {
  const formState = useCreateProjectStore((s) => s.formState)
  const setStep = useCreateProjectStore((s) => s.setStep)
  const reset = useCreateProjectStore((s) => s.reset)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeLabel = formState.type ? TYPE_LABEL[formState.type] : 'Project'
  const config = formState.config as Record<string, unknown>
  const ef = formState.enterpriseFeatures
  const dep = formState.deployment
  const eventing = formState.eventing

  async function handleCreate() {
      setSubmitting(true)
      setError(null)
      try {
        const result = await submitProject(formState)
        reset()
        navigate('/', {
          state: {
            toast: `${typeLabel} created successfully.`,
            deliberationId: result.deliberationId,
            projectName: formState.name,
          },
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        setSubmitting(false)
      }
    }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Review & Create</h2>
        <p className="mt-1 text-sm text-muted-foreground">Double-check everything, then create your {typeLabel.toLowerCase()}.</p>
      </div>

      <SummaryGroup title="Type" stepIndex={0} onEdit={setStep}>
        <SummaryRow label="Type" value={typeLabel} />
      </SummaryGroup>

      <SummaryGroup title="Basics" stepIndex={1} onEdit={setStep}>
        <SummaryRow label="Name" value={formState.name || '—'} />
        <SummaryRow label="Description" value={formState.description || '—'} />
        <SummaryRow label="Owner/Team" value={formState.ownerId} />
        <SummaryRow label="Visibility" value={formState.visibility} />
      </SummaryGroup>

      <SummaryGroup title="Configuration" stepIndex={2} onEdit={setStep}>
        {Object.entries(config).map(([k, v]) => (
          <SummaryRow key={k} label={k} value={Array.isArray(v) ? v.join(', ') || '—' : String(v ?? '—')} />
        ))}
      </SummaryGroup>

      <SummaryGroup title="Enterprise Features" stepIndex={3} onEdit={setStep}>
        <SummaryRow label="Database" value={ef.database?.enabled ? `${ef.database.type} (${ef.database.hosting})` : 'Disabled'} />
        <SummaryRow label="Search" value={ef.search?.enabled ? ef.search.engine : 'Disabled'} />
        <SummaryRow
          label="Identity & Access"
          value={[ef.identityAccess.sso && 'SSO', ef.identityAccess.rbac && 'RBAC', ef.identityAccess.mfa && 'MFA', ef.identityAccess.multiTenant && 'Multi-tenant'].filter(Boolean).join(', ') || 'None'}
        />
        <SummaryRow
          label="Compliance flags"
          value={ef.observabilityCompliance.complianceFlags.join(', ') || 'None (tags only, not auto-implemented)'}
        />
      </SummaryGroup>

      <SummaryGroup title="Deployment" stepIndex={4} onEdit={setStep}>
        <SummaryRow label="Targets" value={dep.targets.length ? dep.targets.join(', ') : 'None selected'} />
        {dep.docker && <SummaryRow label="Docker base image" value={dep.docker.baseImage} />}
        {dep.executable && <SummaryRow label="Executable OS" value={dep.executable.targetOS.join(', ') || '—'} />}
        {dep.cloud && <SummaryRow label="Cloud" value={`${dep.cloud.provider} / ${dep.cloud.region} / ${dep.cloud.environment}`} />}
      </SummaryGroup>

      <SummaryGroup title="Application Eventing">
        <SummaryRow label="Framework" value={eventing.framework} />
        <SummaryRow label="Categories" value={eventing.categories.join(', ')} />
        <SummaryRow label="Format" value={eventing.canonicalFormat} />
        <SummaryRow label="Transport" value={`${eventing.delivery.transport} (Kafka)`} />
        <SummaryRow label="PII policy" value={eventing.piiHandling} />
      </SummaryGroup>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? 'Creating…' : error ? `Retry — Create ${typeLabel}` : `Create ${typeLabel}`}
      </button>
    </div>
  )
}
