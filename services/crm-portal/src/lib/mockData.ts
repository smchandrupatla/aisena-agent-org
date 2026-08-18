export const OWNERS = [
  { id: 'me', label: 'You (current user)' },
  { id: 'platform-team', label: 'Platform Team' },
  { id: 'growth-team', label: 'Growth Team' },
  { id: 'design-team', label: 'Design Team' },
]

export const WEB_APP_FRAMEWORKS = ['React', 'Next.js', 'Vue', 'Svelte', 'Angular']
export const WEB_APP_TEMPLATES = ['Blank', 'Dashboard', 'CRUD admin', 'Kanban board']
export const AUTH_PROVIDERS = ['Email/Password', 'OAuth (Google/GitHub)', 'SSO (SAML/OIDC)']

export const WEBSITE_DEFAULT_PAGES = ['Home', 'About', 'Contact', 'Pricing', 'Blog', 'FAQ']

export const PORTAL_MODULES = ['Documents', 'Tickets/Support', 'Billing', 'Announcements', 'Custom']

export const DATABASE_TYPES: { value: string; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'sqlite', label: 'SQLite (dev-only)' },
  { value: 'other', label: 'Other' },
]

export const SEARCH_ENGINES: { value: string; label: string }[] = [
  { value: 'db_fulltext', label: 'Built-in DB full-text search' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
  { value: 'opensearch', label: 'OpenSearch' },
  { value: 'algolia', label: 'Algolia' },
  { value: 'meilisearch', label: 'Meilisearch' },
  { value: 'typesense', label: 'Typesense' },
]

export const CLOUD_PROVIDERS: { value: string; label: string; regions: string[] }[] = [
  { value: 'aws', label: 'AWS', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
  { value: 'azure', label: 'Azure', regions: ['eastus', 'westeurope', 'southeastasia'] },
  { value: 'gcp', label: 'GCP', regions: ['us-central1', 'europe-west1', 'asia-southeast1'] },
  { value: 'vercel', label: 'Vercel', regions: ['global-edge'] },
  { value: 'netlify', label: 'Netlify', regions: ['global-edge'] },
  { value: 'render', label: 'Render', regions: ['oregon', 'frankfurt', 'singapore'] },
  { value: 'heroku', label: 'Heroku', regions: ['us', 'eu'] },
  { value: 'other', label: 'Other', regions: ['custom'] },
]

export const ACCEPTED_UPLOAD_TYPES = [
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.csv',
  '.xlsx',
]

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
export const MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024
