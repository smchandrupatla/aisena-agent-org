export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isSlugSafe(name: string): boolean {
  const slug = slugify(name)
  return slug.length > 0 && slug === name.trim().toLowerCase().replace(/\s+/g, '-')
    ? true
    : slug.length > 0
}

// Simulated backend registry of taken slugs, used to demo the async
// uniqueness check. In production this would be a debounced call to the
// project API (e.g. GET /api/projects/check-name?slug=...).
const TAKEN_SLUGS = new Set(['acme-portal', 'demo-app', 'marketing-site', 'internal-tool'])

export function checkNameUnique(name: string): Promise<{ unique: boolean; suggestion?: string }> {
  const slug = slugify(name)
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!slug || !TAKEN_SLUGS.has(slug)) {
        resolve({ unique: true })
        return
      }
      let candidate = `${slug}-2`
      let n = 2
      while (TAKEN_SLUGS.has(candidate)) {
        n += 1
        candidate = `${slug}-${n}`
      }
      resolve({ unique: false, suggestion: candidate })
    }, 400)
  })
}
