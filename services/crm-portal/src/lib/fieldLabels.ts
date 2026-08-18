const OVERRIDES: Record<string, string> = {
  sso: 'Single Sign-On',
  rbac: 'RBAC',
  rbacDefaultRoles: 'Default Roles',
  mfa: 'Multi-Factor Authentication',
  multiTenant: 'Multi-Tenancy',
  seo: 'SEO',
  apiExposure: 'API Exposure',
  autoDeployOnPush: 'Auto-Deploy on Push',
  backupsAndDR: 'Backups & Disaster Recovery',
  complianceFlags: 'Compliance Flags',
  ownerId: 'Owner/Team',
  authProvider: 'Auth Provider',
  authRequired: 'Auth Required',
  dataLayer: 'Data Layer',
  targetOS: 'Target OS',
  codeSigning: 'Code Signing',
  autoUpdate: 'Auto-Update',
  includeCompose: 'Include docker-compose.yml',
  baseImage: 'Base Image',
  exposedPort: 'Exposed Port',
  accessControl: 'Access Control',
  siteType: 'Site Type',
  multiTenancy: 'Multi-Tenancy Strategy',
  multiCurrency: 'Multi-Currency',
  multiLanguage: 'Multi-Language (i18n)',
}

function titleCase(segment: string): string {
  return OVERRIDES[segment] ?? segment.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

/** Turns a dot-path like `enterpriseFeatures.identityAccess.sso` into `SSO`. */
export function labelForPath(path: string): string {
  const segments = path.split('.')
  return titleCase(segments[segments.length - 1])
}

/** Turns a dot-path into a breadcrumb-style label, e.g. `Config › Audience`. */
export function groupLabelForPath(path: string): string {
  const segments = path.split('.')
  if (segments.length <= 1) return titleCase(segments[0])
  const group = titleCase(segments[segments.length - 2])
  const leaf = titleCase(segments[segments.length - 1])
  return `${group} › ${leaf}`
}
