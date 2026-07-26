import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '../../api/_lib/vercel-types'
import { sealToken } from '../../api/_lib/tokens'
import startHandler from '../../api/attempt/start'
import submitHandler from '../../api/attempt/submit'
import validateHandler from '../../api/session/validate'
import { buildAssessmentVariantManifest, CONTENT_VERSION } from '../../src/content'
import { analyzeRoute, type MissionResponse } from '../../src/domain'

const ORIGINAL_ENV = { ...process.env }
const TEACHER_SESSION_ID = 'd1f74d5c-f79a-4ae6-901a-8da4f2c33c00'
const ATTEMPT_ID = '063e1d0e-2a28-48c4-8fd8-4b27d6083e93'
const STUDENT_HASH = 'a'.repeat(64)
const VARIANT_SEED = 'cc9d1fbd-36bf-4ce9-a762-ea19a967ac51'

function request(body: unknown): VercelRequest {
  return { method: 'POST', headers: {}, body }
}

function responseHarness(): { response: VercelResponse; status: () => number; body: () => unknown } {
  let statusCode = 200
  let responseBody: unknown
  const response: VercelResponse = {
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn((code: number) => { statusCode = code; return response }),
    json: vi.fn((value: unknown) => { responseBody = value; return response }),
  }
  return { response, status: () => statusCode, body: () => responseBody }
}

function bridgeSuccess(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function correctResponses(seed: string): MissionResponse[] {
  return buildAssessmentVariantManifest(seed).missions.map((mission): MissionResponse => {
    if (mission.kind === 'CONCEPT_PROBE') {
      return { missionId: mission.id, variantId: mission.variantId, kind: 'CONCEPT', selectedOptionId: mission.correctOptionId }
    }
    const route = mission.kind === 'PLAN_ROUTE' ? mission.exampleSolution : mission.route
    const analysis = analyzeRoute(route)
    const measurement = {
      missionId: mission.id,
      variantId: mission.variantId,
      distance: analysis.distance,
      displacementMagnitude: analysis.displacement.magnitude,
      displacementDirection: analysis.displacement.direction === 'DIAGONAL' ? null : analysis.displacement.direction,
    }
    return mission.kind === 'PLAN_ROUTE'
      ? { ...measurement, kind: 'PLANNING', route }
      : { ...measurement, kind: 'MEASUREMENT' }
  })
}

describe('Vercel API handlers', () => {
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

  it('validates a session without returning the internal Sheets session id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bridgeSuccess({
      teacherSessionId: TEACHER_SESSION_ID,
      label: '2nd hour - Jul 15',
      allowedPeriod: '2nd hour',
      closesAt: new Date(Date.now() + 60_000).toISOString(),
    })))
    const harness = responseHarness()
    await validateHandler(request({ code: 'AB23CD', classPeriod: '2nd hour' }), harness.response)
    expect(harness.status()).toBe(200)
    const payload = harness.body() as { data: Record<string, unknown> }
    expect(payload.data.sessionToken).toEqual(expect.any(String))
    expect(payload.data).not.toHaveProperty('teacherSessionId')
  })

  it('starts an attempt with an answer-free public variant manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bridgeSuccess({
      attemptId: ATTEMPT_ID,
      studentKeyHash: STUDENT_HASH,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      checkpoint: null,
      variantSeed: VARIANT_SEED,
      contentVersion: CONTENT_VERSION,
    })))
    const sessionToken = sealToken({
      kind: 'session', issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
      teacherSessionId: TEACHER_SESSION_ID, allowedPeriod: '2nd hour',
    })
    const harness = responseHarness()
    await startHandler(request({
      sessionToken,
      clientAttemptId: randomUUID(),
      student: { firstName: 'Test', lastName: 'Student', classPeriod: '2nd hour' },
    }), harness.response)
    expect(harness.status()).toBe(200)
    const payload = harness.body() as { data: Record<string, unknown> }
    const serialized = JSON.stringify(payload.data.variantManifest)
    expect(serialized).not.toContain('correctOptionId')
    expect(serialized).not.toContain('exampleSolution')
    expect(serialized).not.toContain('explanation')
    expect(payload.data).not.toHaveProperty('variantSeed')
  })

  it('recomputes the canonical score and withholds the teacher ClassPoints cue', async () => {
    let signedData: Record<string, unknown> | undefined
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const envelope = JSON.parse(String(init.body)) as { body: string }
      signedData = (JSON.parse(envelope.body) as { data: Record<string, unknown> }).data
      return bridgeSuccess({ duplicate: false, submittedAt: new Date().toISOString() })
    }))
    const attemptToken = sealToken({
      kind: 'attempt', issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
      teacherSessionId: TEACHER_SESSION_ID, attemptId: ATTEMPT_ID,
      studentKeyHash: STUDENT_HASH, classPeriod: '2nd hour',
      variantSeed: VARIANT_SEED, contentVersion: CONTENT_VERSION,
    })
    const now = new Date()
    const harness = responseHarness()
    await submitHandler(request({
      attemptToken,
      attemptId: ATTEMPT_ID,
      appVersion: 'test-app',
      contentVersion: CONTENT_VERSION,
      startedAt: new Date(now.getTime() - 60_000).toISOString(),
      submittedAt: now.toISOString(),
      responses: correctResponses(VARIANT_SEED).reverse(),
    }), harness.response)
    expect(harness.status()).toBe(200)
    const payload = harness.body() as { data: Record<string, unknown> }
    expect(payload.data.score).toBe(20)
    expect(payload.data.masteryTier).toBe(5)
    expect(payload.data).not.toHaveProperty('classPointsCue')
    const review = payload.data.review as Record<string, Record<string, unknown>>
    const manifest = buildAssessmentVariantManifest(VARIANT_SEED)
    const a1 = manifest.missions.find((mission) => mission.id === 'A1')
    if (!a1 || a1.kind !== 'OBSERVE_ROUTE') throw new Error('Expected A1 observation mission')
    const a1Analysis = analyzeRoute(a1.route)
    expect(review.A1).toEqual({
      distance: a1Analysis.distance,
      magnitude: a1Analysis.displacement.magnitude,
      direction: a1Analysis.displacement.direction.toLowerCase(),
    })
    expect(review).toHaveProperty('A4')
    expect(review).not.toHaveProperty('C1')
    expect(signedData).toBeDefined()
    const canonical = signedData as Record<string, unknown>
    expect((canonical.result as Record<string, unknown>).classPointsCue).toBe(5)
    expect((canonical.responses as Array<{ missionId: string }>).map(item => item.missionId))
      .toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3'])
    expect(canonical).not.toHaveProperty('student')
  })

  it('rejects an incomplete final submission before calling the Sheets bridge', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const attemptToken = sealToken({
      kind: 'attempt', issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
      teacherSessionId: TEACHER_SESSION_ID, attemptId: ATTEMPT_ID,
      studentKeyHash: STUDENT_HASH, classPeriod: '2nd hour',
      variantSeed: VARIANT_SEED, contentVersion: CONTENT_VERSION,
    })
    const responses = correctResponses(VARIANT_SEED)
    responses[0] = { ...responses[0], distance: null } as MissionResponse
    const now = new Date()
    const harness = responseHarness()
    await submitHandler(request({
      attemptToken,
      attemptId: ATTEMPT_ID,
      appVersion: 'test-app',
      contentVersion: CONTENT_VERSION,
      startedAt: new Date(now.getTime() - 60_000).toISOString(),
      submittedAt: now.toISOString(),
      responses,
    }), harness.response)
    expect(harness.status()).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(harness.body()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    })
  })

  it('rejects answers from a different deterministic variant before saving', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const attemptToken = sealToken({
      kind: 'attempt', issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
      teacherSessionId: TEACHER_SESSION_ID, attemptId: ATTEMPT_ID,
      studentKeyHash: STUDENT_HASH, classPeriod: '2nd hour',
      variantSeed: VARIANT_SEED, contentVersion: CONTENT_VERSION,
    })
    const responses = correctResponses(VARIANT_SEED)
    responses[0] = { ...responses[0], variantId: 'A1-NOT-ASSIGNED' } as MissionResponse
    const now = new Date()
    const harness = responseHarness()
    await submitHandler(request({
      attemptToken,
      attemptId: ATTEMPT_ID,
      appVersion: 'test-app',
      contentVersion: CONTENT_VERSION,
      startedAt: new Date(now.getTime() - 60_000).toISOString(),
      submittedAt: now.toISOString(),
      responses,
    }), harness.response)
    expect(harness.status()).toBe(409)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(harness.body()).toMatchObject({ ok: false, error: { code: 'VARIANT_MISMATCH' } })
  })
})
