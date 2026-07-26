import { createHmac, randomUUID } from 'node:crypto'
import { ApiError } from './errors.js'

type BridgeEnvelope = {
  timestamp: number
  nonce: string
  body: string
  signature: string
}

type BridgeSuccess<T> = { ok: true; data: T }
type BridgeFailure = {
  ok: false
  error?: { code?: string; message?: string; details?: unknown }
}

const BRIDGE_TIMEOUT_MS = 12_000

function getBridgeConfiguration(): { url: string; secret: string } {
  const url = process.env.APPS_SCRIPT_BRIDGE_URL ?? process.env.PIRATE_PATH_APPS_SCRIPT_BRIDGE_URL
  const secret = process.env.APPS_SCRIPT_BRIDGE_SECRET ?? process.env.PIRATE_PATH_BRIDGE_SECRET
  if (!url || !secret) {
    throw new ApiError(
      'BACKEND_NOT_CONFIGURED',
      'Google Sheets saving is not configured for this preview. No student result was sent.',
      503,
    )
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new ApiError('BACKEND_NOT_CONFIGURED', 'The configured classroom service URL is invalid.', 503)
  }
  if (parsedUrl.protocol !== 'https:' || !['script.google.com', 'script.googleusercontent.com'].includes(parsedUrl.hostname)) {
    throw new ApiError('BACKEND_NOT_CONFIGURED', 'The configured classroom service URL is invalid.', 503)
  }
  if (secret.length < 32) {
    throw new ApiError('BACKEND_NOT_CONFIGURED', 'The classroom service secret is not configured safely.', 503)
  }
  return { url, secret }
}

export function createBridgeEnvelope(
  action: string,
  data: unknown,
  secret: string,
  timestamp = Date.now(),
  nonce: string = randomUUID(),
): BridgeEnvelope {
  const body = JSON.stringify({ action, data })
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${body}`, 'utf8')
    .digest('base64url')
  return { timestamp, nonce, body, signature }
}

export async function bridgeCall<T>(action: string, data: unknown): Promise<T> {
  const { url, secret } = getBridgeConfiguration()
  const envelope = createBridgeEnvelope(action, data, secret)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS)

  try {
    const bridgeResponse = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    })

    if (!bridgeResponse.ok) {
      throw new ApiError(
        'SHEETS_UNAVAILABLE',
        'The teacher results sheet is temporarily unavailable. Your work is still saved on this device.',
        503,
      )
    }

    const parsed = (await bridgeResponse.json()) as BridgeSuccess<T> | BridgeFailure
    if (!parsed.ok) {
      const code = parsed.error?.code || 'SHEETS_REJECTED_REQUEST'
      const status = code === 'ATTEMPT_ALREADY_SUBMITTED' || code === 'SUBMISSION_CONFLICT' || code === 'ATTEMPT_MISMATCH'
        ? 409
        : code === 'SESSION_NOT_AVAILABLE' || code === 'PERIOD_MISMATCH'
          ? 403
          : code === 'INVALID_SIGNATURE' || code === 'STALE_REQUEST' || code === 'REPLAYED_REQUEST'
            ? 401
        : 400
      throw new ApiError(
        code,
        parsed.error?.message || 'The teacher results sheet rejected this request.',
        status,
        parsed.error?.details,
      )
    }
    return parsed.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      'SHEETS_UNAVAILABLE',
      'The teacher results sheet could not be reached. Your work is still saved on this device.',
      503,
    )
  } finally {
    clearTimeout(timeout)
  }
}
