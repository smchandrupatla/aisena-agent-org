import type { CreateProjectPayload } from '../types/project'
import { slugify } from './slug'

export interface StepValidation {
  errors: string[]
  warnings: string[]
}

const ADMIN_LIKE = /admin|owner|superuser/i

export function validateType(formState: CreateProjectPayload): StepValidation {
  return { errors: formState.type ? [] : ['Choose a project type to continue.'], warnings: [] }
}

export function validateBasics(
  formState: CreateProjectPayload,
  nameUniqueStatus: 'idle' | 'checking' | 'unique' | 'duplicate',
): StepValidation {
  const errors: string[] = []
  const name = formState.name.trim()
  if (!name) {
    errors.push('Name is required.')
  } else if (name.length < 3 || name.length > 60) {
    errors.push('Name must be between 3 and 60 characters.')
  } else if (!slugify(name)) {
    errors.push('Name must contain at least one letter or number.')
  } else if (nameUniqueStatus === 'duplicate') {
    errors.push('That name is already taken in this workspace — try the suggested alternative.')
  } else if (nameUniqueStatus === 'checking') {
    errors.push('Still checking name availability…')
  }
  return { errors, warnings: [] }
}

export function validateConfiguration(formState: CreateProjectPayload): StepValidation {
  const errors: string[] = []
  const warnings: string[] = []
  if (formState.type === 'portal') {
    const modules = (formState.config as { modules?: string[] }).modules ?? []
    if (modules.length === 0) errors.push('Select at least one module for the portal.')
  }
  if (formState.type === 'website') {
    const domain = (formState.config as { domain?: string }).domain
    if (domain) {
      const domainRe = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i
      if (!domainRe.test(domain)) warnings.push('Domain format looks off — double check before creating.')
    }
  }
  return { errors, warnings }
}

export function validateEnterpriseFeatures(formState: CreateProjectPayload): StepValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const ef = formState.enterpriseFeatures
  if (ef.database?.enabled) {
    if (!ef.database.type) errors.push('Database type is required.')
    if (!ef.database.hosting) errors.push('Database hosting is required.')
  }
  if (ef.search?.enabled && !ef.search.engine) {
    errors.push('Search engine is required.')
  }
  if (ef.identityAccess.rbac && ef.identityAccess.rbacDefaultRoles?.length) {
    const hasAdmin = ef.identityAccess.rbacDefaultRoles.some((r) => ADMIN_LIKE.test(r))
    if (!hasAdmin) {
      warnings.push(
        'None of the default roles look like an admin role — you may lock yourself out. Consider adding "Admin".',
      )
    }
  }
  if (ef.identityAccess.multiTenant && !ef.database?.multiTenancy) {
    warnings.push(
      'Multi-tenancy is enabled under Identity & Access, but no Database multi-tenancy strategy is set. These are related — consider setting one in the Database section.',
    )
  }
  return { errors, warnings }
}

export function validateDeployment(formState: CreateProjectPayload): StepValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const d = formState.deployment
  if (d.targets.length === 0) {
    errors.push('Select at least one deployment target.')
  }
  if (d.targets.includes('executable') && (!d.executable || d.executable.targetOS.length === 0)) {
    errors.push('Choose at least one target OS for the executable build.')
  }
  if (d.targets.includes('cloud')) {
    if (!d.cloud?.provider) errors.push('Choose a cloud provider.')
    if (!d.cloud?.region) errors.push('Choose a region.')
  }
  if (d.targets.includes('executable') && d.targets.length > 1) {
    warnings.push('Executable is usually chosen on its own — combining it with Docker/Cloud is unusual but allowed.')
  }
  return { errors, warnings }
}
