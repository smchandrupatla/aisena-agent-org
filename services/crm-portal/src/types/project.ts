// Core data model for the "Create New App" flow (Web App / Website / Portal).
// Mirrors the shapes agreed in the product spec so the client, store, and any
// future server-side assistant/API endpoints share one contract.

export type ProjectType = 'web_app' | 'website' | 'portal'

export type Visibility = 'private' | 'team' | 'public'

export interface WebAppConfig {
  framework: string
  authRequired: boolean
  authProvider?: string
  dataLayer: 'none' | 'database' | 'api'
  template: string
}

export interface WebsiteConfig {
  siteType: 'landing' | 'multipage' | 'blog'
  pages: string[]
  domain?: string
  seo?: { title?: string; description?: string }
}

export interface PortalConfig {
  audience: 'customer' | 'partner' | 'internal' | 'vendor'
  accessControl: 'invite' | 'domain' | 'public_login'
  modules: string[]
  branding?: { logoUrl?: string; primaryColor?: string }
}

export type AnyConfig = WebAppConfig | WebsiteConfig | PortalConfig

export type DatabaseType = 'postgresql' | 'mysql' | 'mongodb' | 'sqlserver' | 'sqlite' | 'other'
export type DatabaseHosting = 'managed' | 'self_hosted' | 'byo_connection_string'
export type MultiTenancyStrategy =
  | 'single_tenant'
  | 'shared_schema'
  | 'schema_per_tenant'
  | 'db_per_tenant'

export type SearchEngine =
  | 'db_fulltext'
  | 'elasticsearch'
  | 'opensearch'
  | 'algolia'
  | 'meilisearch'
  | 'typesense'

export type ComplianceFlag = 'gdpr' | 'soc2' | 'hipaa' | 'data_residency'

export type ApiExposure = 'none' | 'rest' | 'graphql' | 'both'

export interface EnterpriseFeaturesConfig {
  database?: {
    enabled: boolean
    type: DatabaseType
    hosting: DatabaseHosting
    multiTenancy?: MultiTenancyStrategy
  }
  search?: {
    enabled: boolean
    engine: SearchEngine
    scope: string[]
  }
  identityAccess: {
    sso: boolean
    rbac: boolean
    rbacDefaultRoles?: string[]
    mfa: boolean
    multiTenant: boolean
  }
  dataReliability: {
    caching: boolean
    backgroundJobs: boolean
    backupsAndDR: boolean
    rateLimiting: boolean
  }
  observabilityCompliance: {
    auditLogging: boolean
    monitoring: boolean
    centralizedLogging: boolean
    complianceFlags: ComplianceFlag[]
  }
  integrationComms: {
    apiExposure: ApiExposure
    webhooks: boolean
    emailNotifications: boolean
    pushNotifications: boolean
    thirdPartyIntegrations: string[]
  }
  i18n: {
    multiLanguage: boolean
    multiCurrency: boolean
  }
}

export type DeploymentTarget = 'docker' | 'executable' | 'cloud'

export type CloudProvider =
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'vercel'
  | 'netlify'
  | 'render'
  | 'heroku'
  | 'other'

export interface DeploymentConfig {
  targets: DeploymentTarget[]
  docker?: {
    baseImage: string
    exposedPort: number
    includeCompose: boolean
    registry?: 'dockerhub' | 'private' | 'none'
  }
  executable?: {
    targetOS: ('windows' | 'macos' | 'linux')[]
    packagingTool: string
    autoUpdate: boolean
    codeSigning: boolean
  }
  cloud?: {
    provider: CloudProvider
    region: string
    environment: 'development' | 'staging' | 'production'
    autoDeployOnPush: boolean
  }
}

export interface EventingConfig {
  enabled: boolean
  framework: 'aisena-eventing'
  frameworkVersion: string
  canonicalFormat: 'JSON'
  categories: ('TECHNICAL' | 'BUSINESS')[]
  definitionRegistry: string
  piiHandling: 'EXCLUDE' | 'MASK' | 'TOKENIZE'
  delivery: {
    transport: 'KAFKA'
    technicalTopic: string
    businessTopic: string
  }
}

export interface CreateProjectPayload {
  type: ProjectType | null
  name: string
  description?: string
  ownerId: string
  visibility: Visibility
  config: Partial<WebAppConfig & WebsiteConfig & PortalConfig>
  enterpriseFeatures: EnterpriseFeaturesConfig
  deployment: DeploymentConfig
  eventing: EventingConfig
}

export type UploadStatus = 'uploading' | 'processing' | 'ready' | 'error'

export interface UploadedDoc {
  id: string
  fileName: string
  fileType: string
  sizeBytes: number
  uploadStatus: UploadStatus
  progress: number
  extractedText?: string
  extractionFailed?: boolean
  tag?: string
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  appliedUpdates?: { path: string; label: string; value: unknown }[]
  pendingConflicts?: {
    path: string
    label: string
    oldValue: unknown
    newValue: unknown
    resolved?: 'accepted' | 'dismissed'
  }[]
  followUpQuestions?: string[]
  isError?: boolean
  reverted?: boolean
}

export interface AssistantContext {
  currentFormState: CreateProjectPayload
  uploadedDocs: UploadedDoc[]
  chatHistory: { role: 'user' | 'assistant'; content: string }[]
}

export interface AssistantResponse {
  message: string
  suggestedFieldUpdates?: Partial<CreateProjectPayload>
  followUpQuestions?: string[]
}
