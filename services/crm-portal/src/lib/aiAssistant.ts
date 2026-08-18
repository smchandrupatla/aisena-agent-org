import type { AssistantContext, AssistantResponse, CreateProjectPayload } from '../types/project'
import { explainTerm } from './fieldGlossary'

// NOTE: In production this module's logic should live server-side (e.g. a
// `POST /api/assistant` endpoint) so the model call/key is never exposed to
// the client, per the spec's "keep the assistant call server-side" note.
// `requestAssistant` is the single seam to swap the body below for a
// `fetch('/api/assistant', { method: 'POST', body: JSON.stringify(context) })`
// call without touching any calling component.

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n))
}

function extractDomain(text: string): string | undefined {
  const match = text.match(/\b([a-z0-9-]+\.(?:com|io|org|net|co|app))\b/i)
  return match?.[1]
}

function inferType(text: string): CreateProjectPayload['type'] | undefined {
  if (includesAny(text, ['portal'])) return 'portal'
  if (includesAny(text, ['website', 'landing page', 'marketing site', 'brochure site', 'blog'])) return 'website'
  if (includesAny(text, ['web app', 'dashboard', 'saas', 'application', 'internal tool', 'crud', 'kanban'])) {
    return 'web_app'
  }
  return undefined
}

function inferName(text: string, type: CreateProjectPayload['type'] | undefined): string | undefined {
  const quoted = text.match(/["“]([^"”]{3,60})["”]/)
  if (quoted) return quoted[1]
  const called = text.match(/(?:called|named)\s+([a-z0-9][a-z0-9\s-]{2,40})/i)
  if (called) return called[1].trim()
  if (type === 'portal' && text.includes('customer')) return 'Customer Portal'
  if (type === 'portal' && text.includes('partner')) return 'Partner Portal'
  if (type === 'portal' && text.includes('vendor')) return 'Vendor Portal'
  if (type === 'portal') return 'Internal Portal'
  return undefined
}

export async function runAssistantHeuristic(
  userMessage: string,
  context: AssistantContext,
): Promise<AssistantResponse> {
  const explanation = explainTerm(userMessage)
  if (explanation && /what|explain|mean|means/i.test(userMessage)) {
    return { message: explanation }
  }

  const docsText = context.uploadedDocs
    .filter((d) => d.extractedText)
    .map((d) => d.extractedText)
    .join('\n')
  const combined = `${userMessage}\n${docsText}`.toLowerCase()
  const usedDocs = context.uploadedDocs.filter((d) => d.extractedText).length > 0

  const type = inferType(combined)
  const updates: DeepPartial<CreateProjectPayload> = {}
  const summaryParts: string[] = []
  const followUps: string[] = []

  if (type && type !== context.currentFormState.type) {
    updates.type = type
    summaryParts.push(`set the type to **${type.replace('_', ' ')}**`)
  }
  const effectiveType = type ?? context.currentFormState.type ?? undefined

  const name = inferName(combined, effectiveType)
  if (name && !context.currentFormState.name) {
    updates.name = name
    summaryParts.push(`suggested the name "${name}"`)
  }
  if (!context.currentFormState.description && userMessage.trim().length > 20) {
    updates.description = userMessage.trim().slice(0, 160)
    summaryParts.push('drafted a short description')
  }

  const config: Record<string, unknown> = {}
  if (effectiveType === 'portal') {
    if (includesAny(combined, ['customer'])) config.audience = 'customer'
    else if (includesAny(combined, ['partner'])) config.audience = 'partner'
    else if (includesAny(combined, ['vendor'])) config.audience = 'vendor'
    else if (includesAny(combined, ['internal', 'employee'])) config.audience = 'internal'

    if (includesAny(combined, ['company email', 'email domain', 'domain-restricted', 'domain restricted'])) {
      config.accessControl = 'domain'
    } else if (includesAny(combined, ['invite'])) {
      config.accessControl = 'invite'
    } else if (includesAny(combined, ['public'])) {
      config.accessControl = 'public_login'
    }

    const modules: string[] = []
    if (includesAny(combined, ['invoice', 'billing'])) modules.push('Billing')
    if (includesAny(combined, ['ticket', 'support'])) modules.push('Tickets/Support')
    if (includesAny(combined, ['document'])) modules.push('Documents')
    if (includesAny(combined, ['announcement'])) modules.push('Announcements')
    if (modules.length) config.modules = modules

    if (!config.accessControl) {
      followUps.push("What should visitors see if they're not logged in?")
    }
  } else if (effectiveType === 'web_app') {
    const frameworks = ['next.js', 'react', 'vue', 'svelte', 'angular']
    const found = frameworks.find((f) => combined.includes(f))
    if (found) config.framework = found === 'next.js' ? 'Next.js' : found[0].toUpperCase() + found.slice(1)
    if (includesAny(combined, ['login', 'sign in', 'authentication', 'auth'])) config.authRequired = true
    if (includesAny(combined, ['database', 'postgres', 'mysql', 'mongo'])) config.dataLayer = 'database'
    else if (includesAny(combined, [' api', 'api-backed'])) config.dataLayer = 'api'
  } else if (effectiveType === 'website') {
    if (includesAny(combined, ['blog'])) config.siteType = 'blog'
    else if (includesAny(combined, ['landing page'])) config.siteType = 'landing'
    else if (includesAny(combined, ['multi-page', 'multipage'])) config.siteType = 'multipage'
    const domain = extractDomain(combined)
    if (domain) config.domain = domain
  }
  if (Object.keys(config).length) {
    updates.config = config as never
    summaryParts.push('pre-filled Configuration')
  }

  const enterpriseFeatures: Record<string, unknown> = {}
  const identityAccess: Record<string, unknown> = {}
  if (includesAny(combined, ['sso', 'single sign-on', 'single sign on'])) identityAccess.sso = true
  if (includesAny(combined, ['rbac', 'role-based', 'roles'])) identityAccess.rbac = true
  if (includesAny(combined, ['mfa', 'multi-factor', 'two-factor', '2fa'])) identityAccess.mfa = true
  if (includesAny(combined, ['multi-tenant', 'multi tenant', 'multitenant'])) identityAccess.multiTenant = true
  if (Object.keys(identityAccess).length) enterpriseFeatures.identityAccess = identityAccess

  const observabilityCompliance: Record<string, unknown> = {}
  if (includesAny(combined, ['audit log', 'audit trail', 'compliance'])) observabilityCompliance.auditLogging = true
  const flags: string[] = []
  if (combined.includes('gdpr')) flags.push('gdpr')
  if (combined.includes('hipaa')) flags.push('hipaa')
  if (combined.includes('soc 2') || combined.includes('soc2')) flags.push('soc2')
  if (combined.includes('data residency')) flags.push('data_residency')
  if (flags.length) observabilityCompliance.complianceFlags = flags
  if (Object.keys(observabilityCompliance).length) enterpriseFeatures.observabilityCompliance = observabilityCompliance

  const dataReliability: Record<string, unknown> = {}
  if (includesAny(combined, ['cache', 'redis'])) dataReliability.caching = true
  if (includesAny(combined, ['background job', 'task queue', 'async job'])) dataReliability.backgroundJobs = true
  if (Object.keys(dataReliability).length) enterpriseFeatures.dataReliability = dataReliability

  const integrationComms: Record<string, unknown> = {}
  if (includesAny(combined, ['webhook'])) integrationComms.webhooks = true
  if (Object.keys(integrationComms).length) enterpriseFeatures.integrationComms = integrationComms

  const database: Record<string, unknown> = {}
  if (includesAny(combined, ['database', 'postgres'])) {
    database.enabled = true
    database.type = combined.includes('postgres')
      ? 'postgresql'
      : combined.includes('mongo')
        ? 'mongodb'
        : combined.includes('mysql')
          ? 'mysql'
          : 'postgresql'
  }
  if (Object.keys(database).length) enterpriseFeatures.database = database

  const search: Record<string, unknown> = {}
  if (includesAny(combined, ['search'])) {
    search.enabled = true
    search.engine = combined.includes('opensearch')
      ? 'opensearch'
      : combined.includes('elastic')
        ? 'elasticsearch'
        : combined.includes('algolia')
          ? 'algolia'
          : 'db_fulltext'
  }
  if (Object.keys(search).length) enterpriseFeatures.search = search

  if (Object.keys(enterpriseFeatures).length) {
    updates.enterpriseFeatures = enterpriseFeatures as never
    summaryParts.push('checked relevant Enterprise Features')
  }

  const deployment: Record<string, unknown> = {}
  const targets: string[] = []
  if (includesAny(combined, ['docker', 'container'])) targets.push('docker')
  const providers: [string, string][] = [
    ['aws', 'aws'],
    ['azure', 'azure'],
    ['gcp', 'gcp'],
    ['google cloud', 'gcp'],
    ['vercel', 'vercel'],
    ['netlify', 'netlify'],
    ['render', 'render'],
    ['heroku', 'heroku'],
  ]
  const providerHit = providers.find(([kw]) => combined.includes(kw))
  if (providerHit || combined.includes('cloud') || combined.includes('deploy')) {
    targets.push('cloud')
  }
  if (targets.length) {
    deployment.targets = Array.from(new Set(targets))
    if (providerHit) deployment.cloud = { provider: providerHit[1] }
    updates.deployment = deployment as never
    summaryParts.push('selected a Deployment Target')
  }

  let message: string
  if (summaryParts.length === 0) {
    message =
      "I couldn't confidently infer anything new from that — try describing the audience, key features, or where you'd like this deployed."
  } else {
    message = `Got it — I ${summaryParts.join(', ')}.`
    if (usedDocs) {
      message += " I've also read your uploaded documents and used them as context."
    }
  }

  return {
    message,
    suggestedFieldUpdates: Object.keys(updates).length ? (updates as Partial<CreateProjectPayload>) : undefined,
    followUpQuestions: followUps.length ? followUps : undefined,
  }
}

export function requestAssistant(userMessage: string, context: AssistantContext): Promise<AssistantResponse> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      runAssistantHeuristic(userMessage, context).then(resolve).catch(reject)
    }, 500)
  })
}
