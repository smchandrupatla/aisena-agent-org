import type { CreateProjectPayload } from '../types/project'

/** Mirrors createProjectStore's initialFormState() shape for isolated lib/validation tests. */
export function baseFormState(overrides: Partial<CreateProjectPayload> = {}): CreateProjectPayload {
  return {
    type: null,
    name: '',
    description: '',
    ownerId: 'me',
    visibility: 'private',
    config: {},
    enterpriseFeatures: {
      identityAccess: { sso: false, rbac: false, mfa: false, multiTenant: false },
      dataReliability: {
        caching: false,
        backgroundJobs: false,
        backupsAndDR: false,
        rateLimiting: false,
      },
      observabilityCompliance: {
        auditLogging: false,
        monitoring: false,
        centralizedLogging: false,
        complianceFlags: [],
      },
      integrationComms: {
        apiExposure: 'none',
        webhooks: false,
        emailNotifications: false,
        pushNotifications: false,
        thirdPartyIntegrations: [],
      },
      i18n: { multiLanguage: false, multiCurrency: false },
    },
    deployment: { targets: [] },
    eventing: {
      enabled: true,
      framework: 'aisena-eventing',
      frameworkVersion: '1.0.0',
      canonicalFormat: 'JSON',
      categories: ['TECHNICAL', 'BUSINESS'],
      definitionRegistry: 'project/eventing/definitions',
      piiHandling: 'EXCLUDE',
      delivery: {
        transport: 'KAFKA',
        technicalTopic: 'technical-events-development',
        businessTopic: 'business-events-development',
      },
    },
    ...overrides,
  }
}
