import { describe, it, expect } from 'vitest'
import {
  validateType,
  validateBasics,
  validateConfiguration,
  validateEnterpriseFeatures,
  validateDeployment,
} from './validation'
import { baseFormState } from '../test/fixtures'

describe('validateType', () => {
  it('requires a project type to be chosen', () => {
    expect(validateType(baseFormState()).errors).toContain('Choose a project type to continue.')
  })

  it('passes once a type is set', () => {
    expect(validateType(baseFormState({ type: 'web_app' })).errors).toEqual([])
  })
})

describe('validateBasics', () => {
  it('requires a name', () => {
    const result = validateBasics(baseFormState({ name: '' }), 'idle')
    expect(result.errors).toContain('Name is required.')
  })

  it('rejects names shorter than 3 characters', () => {
    const result = validateBasics(baseFormState({ name: 'ab' }), 'idle')
    expect(result.errors).toContain('Name must be between 3 and 60 characters.')
  })

  it('rejects a name already marked as a duplicate', () => {
    const result = validateBasics(baseFormState({ name: 'Acme Portal' }), 'duplicate')
    expect(result.errors).toContain(
      'That name is already taken in this workspace — try the suggested alternative.',
    )
  })

  it('passes for a valid, available name', () => {
    const result = validateBasics(baseFormState({ name: 'My Project' }), 'unique')
    expect(result.errors).toEqual([])
  })
})

describe('validateConfiguration', () => {
  it('requires at least one module for a portal', () => {
    const result = validateConfiguration(
      baseFormState({ type: 'portal', config: { modules: [] } }),
    )
    expect(result.errors).toContain('Select at least one module for the portal.')
  })

  it('warns on a malformed domain for a website', () => {
    const result = validateConfiguration(
      baseFormState({ type: 'website', config: { domain: 'not a domain' } }),
    )
    expect(result.warnings).toContain('Domain format looks off — double check before creating.')
  })

  it('passes for a valid website domain', () => {
    const result = validateConfiguration(
      baseFormState({ type: 'website', config: { domain: 'example.com' } }),
    )
    expect(result.warnings).toEqual([])
  })
})

describe('validateEnterpriseFeatures', () => {
  it('requires database type and hosting when database is enabled', () => {
    const result = validateEnterpriseFeatures(
      baseFormState({
        enterpriseFeatures: {
          ...baseFormState().enterpriseFeatures,
          database: { enabled: true, type: '' as never, hosting: '' as never },
        },
      }),
    )
    expect(result.errors).toEqual(
      expect.arrayContaining(['Database type is required.', 'Database hosting is required.']),
    )
  })

  it('warns when rbac default roles have no admin-like role', () => {
    const result = validateEnterpriseFeatures(
      baseFormState({
        enterpriseFeatures: {
          ...baseFormState().enterpriseFeatures,
          identityAccess: {
            sso: false,
            rbac: true,
            rbacDefaultRoles: ['viewer', 'editor'],
            mfa: false,
            multiTenant: false,
          },
        },
      }),
    )
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('validateDeployment', () => {
  it('requires at least one deployment target', () => {
    const result = validateDeployment(baseFormState({ deployment: { targets: [] } }))
    expect(result.errors).toContain('Select at least one deployment target.')
  })

  it('requires a target OS when the executable target is selected', () => {
    const result = validateDeployment(
      baseFormState({ deployment: { targets: ['executable'], executable: undefined } }),
    )
    expect(result.errors).toContain('Choose at least one target OS for the executable build.')
  })

  it('passes for a single docker deployment target', () => {
    const result = validateDeployment(baseFormState({ deployment: { targets: ['docker'] } }))
    expect(result.errors).toEqual([])
  })
})
