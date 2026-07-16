import type { MissionResponse } from '../domain'
import type { CardinalDirection, PublicVariantManifest } from './types'

interface ApiFailure {
  ok: false
  error: { message?: string }
}

interface ApiSuccess<T> {
  ok: true
  data: T
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const envelope = await response.json() as ApiSuccess<T> | ApiFailure
  if (!response.ok || !envelope.ok) {
    const message = envelope.ok ? 'The classroom service could not complete that request.' : envelope.error.message
    throw new Error(message || 'The classroom service could not complete that request.')
  }
  return envelope.data
}

export interface AttemptRuntime {
  attemptId: string
  attemptToken: string
  practiceSeed: string
  contentVersion: string
  startedAt: string
  mode: 'demo' | 'live'
  publicManifest: PublicVariantManifest
}

interface StartAttemptInput {
  code: string
  firstName: string
  lastName: string
  classPeriod: string
  clientAttemptId: string
}

export async function startLiveAttempt(input: StartAttemptInput): Promise<AttemptRuntime> {
  const session = await post<{ sessionToken: string }>('/api/session/validate', {
    code: input.code,
    classPeriod: input.classPeriod,
  })
  const attempt = await post<{
    attemptToken: string
    attemptId: string
    contentVersion: string
    startedAt: string
    variantManifest: PublicVariantManifest
  }>('/api/attempt/start', {
    sessionToken: session.sessionToken,
    clientAttemptId: input.clientAttemptId,
    student: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      classPeriod: input.classPeriod,
    },
  })
  return {
    attemptId: attempt.attemptId,
    attemptToken: attempt.attemptToken,
    practiceSeed: attempt.attemptId,
    contentVersion: attempt.contentVersion,
    startedAt: attempt.startedAt,
    mode: 'live',
    publicManifest: attempt.variantManifest,
  }
}

interface CheckpointPayload {
  currentMissionId: string
  completedMissionIds: string[]
  responses: MissionResponse[]
}

export async function syncLiveCheckpoint(runtime: AttemptRuntime, payload: CheckpointPayload): Promise<void> {
  await post('/api/attempt/checkpoint', {
    attemptToken: runtime.attemptToken,
    attemptId: runtime.attemptId,
    stateVersion: 2,
    currentMissionId: payload.currentMissionId,
    completedMissionIds: payload.completedMissionIds,
    responses: payload.responses,
    updatedAt: new Date().toISOString(),
  })
}

export interface LiveSubmissionResult {
  score: number
  scoreMax: number
  percent: number
  masteryTier: 1 | 2 | 3 | 4 | 5
  itemResults: Array<{ missionId: string; earned: number; possible: number }>
  misconceptions: string[]
  review: Record<string, { distance?: number; magnitude: number; direction: CardinalDirection }>
}

export async function submitLiveAttempt(
  runtime: AttemptRuntime,
  responses: MissionResponse[],
): Promise<LiveSubmissionResult> {
  return post<LiveSubmissionResult>('/api/attempt/submit', {
    attemptToken: runtime.attemptToken,
    attemptId: runtime.attemptId,
    appVersion: 'pirate-path-v2',
    contentVersion: runtime.contentVersion,
    startedAt: runtime.startedAt,
    submittedAt: new Date().toISOString(),
    responses,
  })
}
