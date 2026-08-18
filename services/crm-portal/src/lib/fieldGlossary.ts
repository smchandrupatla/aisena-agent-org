const GLOSSARY: { keywords: string[]; term: string; explanation: string }[] = [
  {
    keywords: ['domain-restricted', 'domain restricted'],
    term: 'Domain-restricted access',
    explanation:
      'Only people signing up with an email address on an approved domain (e.g. "@yourcompany.com") can get in — no invite needed, but outsiders are blocked automatically.',
  },
  {
    keywords: ['invite-only', 'invite only'],
    term: 'Invite-only access',
    explanation:
      'Nobody can self-register. An admin (or existing member) has to explicitly invite each user before they can log in.',
  },
  {
    keywords: ['public with login', 'public_login', 'public login'],
    term: 'Public with login',
    explanation: 'Anyone can create an account and sign in; there is no allow-list or invite step.',
  },
  {
    keywords: ['sso', 'single sign-on', 'single sign on'],
    term: 'Single Sign-On (SSO)',
    explanation:
      'Lets users log in with credentials from an identity provider they already have (Okta, Azure AD, Google Workspace) via SAML or OIDC, instead of a separate password for this app.',
  },
  {
    keywords: ['rbac', 'role-based access', 'role based access'],
    term: 'Role-Based Access Control (RBAC)',
    explanation:
      'Access to features/data is granted through named roles (e.g. Admin, Editor, Viewer) rather than per-user permissions, so you manage access by assigning roles.',
  },
  {
    keywords: ['mfa', 'multi-factor', 'multi factor'],
    term: 'Multi-Factor Authentication (MFA)',
    explanation:
      'Requires a second proof of identity beyond a password — an authenticator app code, SMS code, or security key — before login succeeds.',
  },
  {
    keywords: ['multi-tenant', 'multi tenant', 'multitenancy', 'multi-tenancy'],
    term: 'Multi-tenancy',
    explanation:
      "Isolates each customer/organization's data from every other's, even though they share the same application deployment.",
  },
  {
    keywords: ['schema-per-tenant', 'schema per tenant'],
    term: 'Schema-per-tenant',
    explanation:
      'Each tenant gets its own database schema (tables) inside a shared database instance — stronger isolation than a shared schema, cheaper than a dedicated database.',
  },
  {
    keywords: ['database-per-tenant', 'database per tenant', 'db-per-tenant'],
    term: 'Database-per-tenant',
    explanation:
      'Each tenant gets an entirely separate database instance — the strongest isolation and easiest to purge/export per customer, but the most operational overhead.',
  },
  {
    keywords: ['shared schema'],
    term: 'Shared schema with tenant ID',
    explanation:
      'All tenants live in the same tables, distinguished by a tenant_id column on every row. Cheapest to run, requires careful query-level isolation.',
  },
  {
    keywords: ['rate limiting', 'throttling'],
    term: 'Rate limiting & throttling',
    explanation:
      'Caps how many requests a user/IP/API key can make in a time window, to protect the service from abuse or accidental overload.',
  },
  {
    keywords: ['audit log', 'audit logging'],
    term: 'Audit logging',
    explanation:
      'Keeps an immutable record of who did what and when (logins, data changes, permission changes) — usually required for compliance reviews.',
  },
  {
    keywords: ['gdpr'],
    term: 'GDPR',
    explanation:
      'EU data-protection regulation. Checking this only tags the project for a later compliance review — it does not automatically implement anything.',
  },
  {
    keywords: ['hipaa'],
    term: 'HIPAA',
    explanation:
      'US healthcare data-privacy law. Checking this only tags the project for later review by your compliance/security team.',
  },
  {
    keywords: ['soc 2', 'soc2'],
    term: 'SOC 2',
    explanation:
      'A security/availability audit standard for service providers. Checking this only tags the project for later review.',
  },
  {
    keywords: ['data residency'],
    term: 'Data residency',
    explanation:
      'A requirement that data be stored/processed within a specific geographic/legal jurisdiction. Checking this only tags the project for later review.',
  },
  {
    keywords: ['webhook'],
    term: 'Webhooks',
    explanation: 'Outbound HTTP notifications this app sends to other systems when events happen.',
  },
  {
    keywords: ['background job', 'task queue'],
    term: 'Background jobs / task queue',
    explanation:
      'Work that runs asynchronously outside the request/response cycle (emails, exports, batch processing) via a queue and worker processes.',
  },
  {
    keywords: ['caching layer', 'redis'],
    term: 'Caching layer',
    explanation:
      'An in-memory store (e.g. Redis) placed in front of the database to serve frequently-read data faster and reduce load.',
  },
]

export function explainTerm(question: string): string | null {
  const q = question.toLowerCase()
  const hit = GLOSSARY.find((entry) => entry.keywords.some((k) => q.includes(k)))
  return hit ? `**${hit.term}**: ${hit.explanation}` : null
}
