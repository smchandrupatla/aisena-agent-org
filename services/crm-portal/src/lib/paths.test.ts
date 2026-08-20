import { describe, it, expect } from 'vitest'
import { getByPath, setByPath, flattenPartial } from './paths'

describe('getByPath', () => {
  it('reads a nested value by dot path', () => {
    const obj = { a: { b: { c: 42 } } }
    expect(getByPath(obj, 'a.b.c')).toBe(42)
  })

  it('returns undefined when an intermediate segment is missing', () => {
    const obj = { a: {} }
    expect(getByPath(obj, 'a.b.c')).toBeUndefined()
  })
})

describe('setByPath', () => {
  it('sets a nested value without mutating the original object', () => {
    const obj = { a: { b: { c: 1 } } }
    const next = setByPath(obj, 'a.b.c', 2)
    expect(next.a.b.c).toBe(2)
    expect(obj.a.b.c).toBe(1)
  })

  it('creates missing intermediate objects along the path', () => {
      const next = setByPath<Record<string, unknown>>({}, 'a.b.c', 'value')
      expect(next).toEqual({ a: { b: { c: 'value' } } })
    })

    it('preserves arrays when traversing through them — does not morph into a plain object', () => {
      const obj = { steps: { items: ['step1', 'step2'] } }
      const next = setByPath(obj, 'steps.items.2', 'step3')
      expect(next.steps.items).toEqual(['step1', 'step2', 'step3'])
      expect(Array.isArray(next.steps.items)).toBe(true)
    })
  })

describe('flattenPartial', () => {
  it('flattens nested objects into dot-path leaves', () => {
    const result = flattenPartial({ a: { b: 1, c: { d: 2 } }, e: 3 })
    expect(result).toEqual(
      expect.arrayContaining([
        { path: 'a.b', value: 1 },
        { path: 'a.c.d', value: 2 },
        { path: 'e', value: 3 },
      ]),
    )
    expect(result).toHaveLength(3)
  })

  it('treats arrays as leaf values instead of recursing into them', () => {
    const result = flattenPartial({ tags: ['x', 'y'] })
    expect(result).toEqual([{ path: 'tags', value: ['x', 'y'] }])
  })

  it('skips undefined leaf values', () => {
    const result = flattenPartial({ a: undefined, b: 1 })
    expect(result).toEqual([{ path: 'b', value: 1 }])
  })

  it('returns an empty array for a non-object with no prefix', () => {
    expect(flattenPartial('not-an-object')).toEqual([])
  })
})
