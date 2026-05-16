// Module-level in-memory cache. Survives client-side navigation but clears on full reload.
// Gives pages instant data on return visits (stale-while-revalidate).
const store = new Map<string, { data: unknown; ts: number }>()
const TTL = 4 * 60 * 1000 // 4 minutes

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) { store.delete(key); return null }
  return entry.data as T
}

export function setCached(key: string, data: unknown) {
  store.set(key, { data, ts: Date.now() })
}
