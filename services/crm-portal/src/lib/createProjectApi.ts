import type { CreateProjectPayload } from '../types/project'

export interface SubmitResult {
  id: string
  payload: CreateProjectPayload
  deliberationId?: string
}

const API_BASE = 'http://localhost:5000/api'

/**
 * Submit a project for creation, then trigger agent deliberation.
 * Returns the project ID and the deliberation ID if successful.
 */
export async function submitProject(payload: CreateProjectPayload): Promise<SubmitResult> {
  const projectId = `proj-${Date.now()}`

  // Attempt to trigger agent deliberation
  let deliberationId: string | undefined
  try {
    const deliberationRes = await fetch(`${API_BASE}/deliberations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (deliberationRes.ok) {
      const deliberation = await deliberationRes.json()
      deliberationId = deliberation.id
    }
  } catch {
    // Deliberation is optional — if the API isn't running, we still succeed
    console.warn('Agent deliberation API unavailable, skipping deliberation')
  }

  return { id: projectId, payload, deliberationId }
}

/**
 * Fetch a deliberation by ID.
 */
export async function fetchDeliberation(deliberationId: string) {
  const res = await fetch(`${API_BASE}/deliberations/${deliberationId}`)
  if (!res.ok) throw new Error(`Deliberation fetch failed: ${res.status}`)
  return res.json()
}

/**
 * Start executing a deliberation's plan.
 */
export async function executeDeliberation(deliberationId: string) {
  const res = await fetch(`${API_BASE}/deliberations/${deliberationId}/execute`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Execution failed: ${res.status}`)
  return res.json()
}

/**
 * Advance a deliberation to the next phase.
 */
export async function advanceDeliberation(deliberationId: string) {
  const res = await fetch(`${API_BASE}/deliberations/${deliberationId}/advance`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Advance failed: ${res.status}`)
  return res.json()
}
