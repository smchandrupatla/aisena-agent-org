// Small path-based helpers used to apply AI-suggested field updates onto the
// nested CreateProjectPayload shape without scattering deep-merge logic
// across components. Arrays and primitives are treated as leaf values (not
// merged element-by-element) — that matches how the form actually edits them.

export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const clone: Record<string, unknown> = { ...(obj as Record<string, unknown>) }
  let cursor: Record<string, unknown> = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    const next = cursor[key]
    const nextClone =
      next && typeof next === 'object' ? { ...(next as Record<string, unknown>) } : {}
    cursor[key] = nextClone
    cursor = nextClone
  }
  cursor[keys[keys.length - 1]] = value
  return clone as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/** Flattens a nested partial object into leaf dot-paths. Arrays are leaves. */
export function flattenPartial(obj: unknown, prefix = ''): { path: string; value: unknown }[] {
  if (!isPlainObject(obj)) {
    return prefix ? [{ path: prefix, value: obj }] : []
  }
  const out: { path: string; value: unknown }[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(value)) {
      out.push(...flattenPartial(value, path))
    } else if (value !== undefined) {
      out.push({ path, value })
    }
  }
  return out
}
