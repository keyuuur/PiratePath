import type { VercelRequest, VercelResponse } from '../_lib/vercel-types.js'
import { bridgeCall } from '../_lib/bridge.js'
import { ApiError } from '../_lib/errors.js'
import { runPostHandler } from '../_lib/http.js'
import {
  hashCanonicalPayload,
  scoreCanonicalAssessment,
  studentResult,
} from '../_lib/scoring-adapter.js'
import { submitAttemptRequestSchema, submitBridgeSchema } from '../_lib/schemas.js'
import { openToken, type AttemptTokenClaims } from '../_lib/tokens.js'
import type { MissionResponse } from '../../src/domain/index.js'

type SubmitBridgeResult = { duplicate: boolean; submittedAt: string }

const MISSION_ORDER = ['A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3'] as const

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await runPostHandler(request, response, async () => {
    const input = submitAttemptRequestSchema.parse(request.body)
    const token = openToken<AttemptTokenClaims>(input.attemptToken, 'attempt')
    if (input.attemptId !== token.attemptId) {
      throw new ApiError('ATTEMPT_MISMATCH', 'This submission does not match the active attempt.', 409)
    }
    if (input.contentVersion !== token.contentVersion) {
      throw new ApiError(
        'CONTENT_VERSION_MISMATCH',
        'The game content changed while this attempt was open. Ask the teacher for help before submitting.',
        409,
      )
    }

    const responses = [...input.responses].sort(
      (left, right) => MISSION_ORDER.indexOf(left.missionId) - MISSION_ORDER.indexOf(right.missionId),
    )
    const score = scoreCanonicalAssessment(
      responses as readonly MissionResponse[],
      token.variantSeed,
    )
    const canonicalInput = {
      teacherSessionId: token.teacherSessionId,
      attemptId: token.attemptId,
      studentKeyHash: token.studentKeyHash,
      appVersion: input.appVersion,
      contentVersion: input.contentVersion,
      variantSeed: token.variantSeed,
      startedAt: input.startedAt,
      submittedAt: input.submittedAt,
      responses,
      result: {
        ...score,
        scoreMax: score.max,
        canvasGrade: score.score,
        reteachRequired: score.masteryTier <= 3,
      },
    }
    const payloadHash = hashCanonicalPayload(canonicalInput)
    const saved = submitBridgeSchema.parse(await bridgeCall<SubmitBridgeResult>('attempt.submit', {
      ...canonicalInput,
      payloadHash,
    }))

    // The teacher-only ClassPoints cue is deliberately excluded here.
    return {
      duplicate: saved.duplicate,
      submittedAt: saved.submittedAt,
      ...studentResult(score, token.variantSeed),
    }
  })
}
