export async function runCopilotAction(payload) {
  try {
    const res = await fetch('/api/copilot/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Copilot Action Error:', err);
    throw err;
  }
}
