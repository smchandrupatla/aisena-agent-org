// Framework -> sensible Docker/packaging defaults. Falls back to a generic
// option rather than leaving fields blank or blocking progress (see spec
// "Edge Cases to Handle").
const DOCKER_BASE_IMAGES: Record<string, string> = {
  'React': 'node:20-alpine',
  'Next.js': 'node:20-alpine',
  'Vue': 'node:20-alpine',
  'Svelte': 'node:20-alpine',
  'Angular': 'node:20-alpine',
}

const PACKAGING_TOOLS: Record<string, string> = {
  'React': 'Electron',
  'Next.js': 'Electron',
  'Vue': 'Tauri',
  'Svelte': 'Tauri',
  'Angular': 'Electron',
}

export const GENERIC_BASE_IMAGE = 'Custom — specify later'
export const GENERIC_PACKAGING_TOOL = 'Custom — specify later'

export function suggestBaseImage(framework: string | undefined): string {
  if (!framework) return 'node:20-alpine'
  return DOCKER_BASE_IMAGES[framework] ?? GENERIC_BASE_IMAGE
}

export function suggestPackagingTool(framework: string | undefined): string {
  if (!framework) return GENERIC_PACKAGING_TOOL
  return PACKAGING_TOOLS[framework] ?? GENERIC_PACKAGING_TOOL
}

export const DEFAULT_EXPOSED_PORT = 3000
