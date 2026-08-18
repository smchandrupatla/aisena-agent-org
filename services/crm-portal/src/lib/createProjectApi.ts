export interface SubmitResult {
  id: string
}

// Simulates an async provisioning call. Swap for a real
// `fetch('/api/projects', { method: 'POST', body: JSON.stringify(payload) })`
// against services/api when a real backend endpoint exists.
export function submitProject(): Promise<SubmitResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.15) {
        reject(new Error('Provisioning timed out. Your entries are safe — try again.'))
      } else {
        resolve({ id: `proj-${Date.now()}` })
      }
    }, 1200)
  })
}
