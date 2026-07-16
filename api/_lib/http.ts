import type { VercelRequest, VercelResponse } from './vercel-types.js'
import { ZodError } from 'zod'
import { ApiError, toApiError } from './errors.js'

const MAX_REQUEST_BYTES = 64 * 1024

export function requirePost(request: VercelRequest): void {
  if (request.method !== 'POST') {
    throw new ApiError('METHOD_NOT_ALLOWED', 'Only POST requests are accepted.', 405)
  }
}

export function assertRequestSize(request: VercelRequest): void {
  const declaredLength = Number(request.headers['content-length'] ?? 0)
  const measuredLength = Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8')
  if (declaredLength > MAX_REQUEST_BYTES || measuredLength > MAX_REQUEST_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', 'The saved game is too large to submit.', 413)
  }
}

export function sendJson(response: VercelResponse, status: number, value: unknown): void {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.status(status).json(value)
}

export function handleApiError(response: VercelResponse, error: unknown): void {
  if (error instanceof ZodError) {
    sendJson(response, 400, {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Some required classroom information is missing or invalid.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    })
    return
  }

  const apiError = toApiError(error)
  if (apiError.status >= 500) {
    // Deliberately omit request bodies, names, codes, responses, and secrets.
    console.error('[pirate-path-api]', apiError.code)
  }
  sendJson(response, apiError.status, {
    ok: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  })
}

export async function runPostHandler(
  request: VercelRequest,
  response: VercelResponse,
  handler: () => Promise<unknown>,
): Promise<void> {
  try {
    requirePost(request)
    assertRequestSize(request)
    const data = await handler()
    sendJson(response, 200, { ok: true, data })
  } catch (error) {
    handleApiError(response, error)
  }
}
