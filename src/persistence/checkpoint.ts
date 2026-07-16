import type { CheckpointState, StudentIdentity } from '../app/types'

const PREFIX = 'pirate-path-v2:'
const MAX_AGE_MS = 4 * 60 * 60 * 1000
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface StoredCheckpoint {
  expiresAt: number
  state: CheckpointState
}

function clearExpiryTimer(key: string): void {
  const timer = expiryTimers.get(key)
  if (timer !== undefined) {
    clearTimeout(timer)
    expiryTimers.delete(key)
  }
}

function parseCheckpoint(raw: string): StoredCheckpoint | null {
  try {
    const stored = JSON.parse(raw) as StoredCheckpoint
    if (
      !Number.isFinite(stored.expiresAt)
      || stored.state?.version !== 2
      || !stored.state.practiceSeed
      || !stored.state.publicManifest?.missions
    ) {
      return null
    }
    return stored
  } catch {
    return null
  }
}

function scheduleExpiry(key: string, expiresAt: number): void {
  clearExpiryTimer(key)
  const delay = Math.max(0, expiresAt - Date.now()) + 1
  const timer = setTimeout(() => {
    expiryTimers.delete(key)
    const stored = localStorage.getItem(key)
    const checkpoint = stored ? parseCheckpoint(stored) : null
    if (!checkpoint || checkpoint.expiresAt <= Date.now()) {
      localStorage.removeItem(key)
    } else {
      scheduleExpiry(key, checkpoint.expiresAt)
    }
  }, delay)
  expiryTimers.set(key, timer)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function checkpointKey(identity: StudentIdentity): Promise<string> {
  const normalized = [
    identity.sessionCode.trim().toUpperCase(),
    identity.classPeriod.trim().toLowerCase(),
    identity.lastName.trim().toLowerCase(),
    identity.firstName.trim().toLowerCase(),
  ].join('|')

  if (!globalThis.crypto?.subtle) {
    // The fallback remains non-reversible and is only used by older local test browsers.
    let hash = 2166136261
    for (const char of normalized) {
      hash ^= char.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    return `${PREFIX}${(hash >>> 0).toString(16)}`
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return `${PREFIX}${bytesToHex(new Uint8Array(digest)).slice(0, 32)}`
}

export function saveCheckpoint(key: string, state: CheckpointState): void {
  clearExpiredCheckpoints()
  const startedAt = Date.parse(state.startedAt)
  const expiresAt = Number.isFinite(startedAt) ? startedAt + MAX_AGE_MS : Date.now() + MAX_AGE_MS
  if (expiresAt <= Date.now()) {
    clearCheckpoint(key)
    return
  }
  const value: StoredCheckpoint = {
    expiresAt,
    state,
  }
  localStorage.setItem(key, JSON.stringify(value))
  scheduleExpiry(key, value.expiresAt)
}

export function loadCheckpoint(key: string): CheckpointState | null {
  clearExpiredCheckpoints()
  const raw = localStorage.getItem(key)
  if (!raw) return null

  const stored = parseCheckpoint(raw)
  if (!stored || stored.expiresAt <= Date.now()) {
    localStorage.removeItem(key)
    clearExpiryTimer(key)
    return null
  }
  scheduleExpiry(key, stored.expiresAt)
  return stored.state
}

export function clearExpiredCheckpoints(now = Date.now()): number {
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
  let removed = 0

  for (const key of keys) {
    if (!key?.startsWith(PREFIX)) continue
    const raw = localStorage.getItem(key)
    const stored = raw ? parseCheckpoint(raw) : null
    if (!stored || stored.expiresAt <= now) {
      localStorage.removeItem(key)
      clearExpiryTimer(key)
      removed += 1
    }
  }

  return removed
}

export function clearCheckpoint(key: string): void {
  clearExpiryTimer(key)
  localStorage.removeItem(key)
}
