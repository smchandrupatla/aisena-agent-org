import { describe, it, expect } from 'vitest'
import { slugify, isSlugSafe } from './slug'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('My New Project')).toBe('my-new-project')
  })

  it('strips special characters', () => {
    expect(slugify('Acme, Inc.!!')).toBe('acme-inc')
  })

  it('collapses repeated hyphens and trims leading/trailing hyphens', () => {
    expect(slugify('  --Foo   Bar--  ')).toBe('foo-bar')
  })

  it('returns an empty string when nothing is left after sanitizing', () => {
    expect(slugify('???')).toBe('')
  })
})

describe('isSlugSafe', () => {
  it('is true for a name that produces a non-empty slug', () => {
    expect(isSlugSafe('foo-bar')).toBe(true)
  })

  it('is false for a name that produces an empty slug', () => {
    expect(isSlugSafe('   ')).toBe(false)
  })
})
