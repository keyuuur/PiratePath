import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeCall, createBridgeEnvelope } from '../../api/_lib/bridge'
import { ApiError } from '../../api/_lib/errors'
import { validateSessionRequestSchema } from '../../api/_lib/schemas'
import { openToken, sealToken, type SessionTokenClaims } from '../../api/_lib/tokens'

const ORIGINAL_ENV = { ...process.env }

describe('API security boundaries', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.TOKEN_SIGNING_SECRET = 'token-secret-that-is-at-least-thirty-two-characters'
    process.env.APPS_SCRIPT_BRIDGE_URL = 'https://script.google.com/macros/s/test/exec'
    process.env.APPS_SCRIPT_BRIDGE_SECRET = 'bridge-secret-that-is-at-least-thirty-two-characters'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it('accepts the approved six-character classroom code and rejects legacy lengths', () => {
    expect(validateSessionRequestSchema.parse({ code: 'ab23cd', classPeriod: '2nd hour' }).code).toBe('AB23CD')
    expect(() => validateSessionRequestSchema.parse({ code: 'AB23CD45', classPeriod: '2nd hour' })).toThrow()
    expect(() => validateSessionRequestSchema.parse({ code: 'AB10OI', classPeriod: '2nd hour' })).toThrow()
  })

  it('creates an opaque authenticated token and rejects tampering', () => {
    const claims: SessionTokenClaims = {
      kind: 'session',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      teacherSessionId: 'd1f74d5c-f79a-4ae6-901a-8da4f2c33c00',
      allowedPeriod: '2nd hour',
    }
    const token = sealToken(claims)
    expect(token).not.toContain(claims.teacherSessionId)
    expect(openToken<SessionTokenClaims>(token, 'session')).toMatchObject(claims)
    const parts = token.split('.')
    parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`
    const tampered = parts.join('.')
    expect(() => openToken<SessionTokenClaims>(tampered, 'session')).toThrowError(ApiError)
  })

  it('requires the full 16-byte GCM authentication tag', () => {
    const claims: SessionTokenClaims = {
      kind: 'session',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      teacherSessionId: 'd1f74d5c-f79a-4ae6-901a-8da4f2c33c00',
      allowedPeriod: '2nd hour',
    }
    const token = sealToken(claims)
    expect(openToken<SessionTokenClaims>(token, 'session')).toMatchObject(claims)

    for (const length of [15, 12, 8, 4]) {
      const parts = token.split('.')
      const fullTag = Buffer.from(parts[3], 'base64url')
      parts[3] = fullTag.subarray(0, length).toString('base64url')
      expect(() => openToken<SessionTokenClaims>(parts.join('.'), 'session')).toThrowError(ApiError)
    }
  })

  it('signs the exact timestamp, nonce, and body sent to Apps Script', () => {
    const envelope = createBridgeEnvelope('attempt.checkpoint', { attemptId: 'safe-id' }, 'test-secret', 1234, 'nonce-123')
    const expected = createHmac('sha256', 'test-secret')
      .update(`1234.nonce-123.${envelope.body}`, 'utf8')
      .digest('base64url')
    expect(envelope.signature).toBe(expected)
    expect(JSON.parse(envelope.body)).toEqual({ action: 'attempt.checkpoint', data: { attemptId: 'safe-id' } })
  })

  it('fails closed without bridge settings and never silently enters live mode', async () => {
    delete process.env.APPS_SCRIPT_BRIDGE_URL
    delete process.env.PIRATE_PATH_APPS_SCRIPT_BRIDGE_URL
    await expect(bridgeCall('session.validate', {})).rejects.toMatchObject({
      code: 'BACKEND_NOT_CONFIGURED',
      status: 503,
    })
  })

  it('maps a conflicting canonical retry to HTTP conflict semantics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: { code: 'SUBMISSION_CONFLICT', message: 'Already submitted with different answers.' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    await expect(bridgeCall('attempt.submit', {})).rejects.toMatchObject({
      code: 'SUBMISSION_CONFLICT',
      status: 409,
    })
  })
})
