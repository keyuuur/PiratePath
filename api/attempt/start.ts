import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '../_lib/vercel-types.js'
import { bridgeCall } from '../_lib/bridge.js'
import { ApiError } from '../_lib/errors.js'
import { runPostHandler } from '../_lib/http.js'
import { CONTENT_VERSION } from '../_lib/scoring-adapter.js'
import { attemptStartBridgeSchema, startAttemptRequestSchema } from '../_lib/schemas.js'
import { openToken, sealToken, type SessionTokenClaims } from '../_lib/tokens.js'
import { buildAssessmentVariantManifest } from '../../src/content/index.js'

type AttemptStartResult = {
  attemptId: string
  studentKeyHash: string
  status: 'in_progress'
  startedAt: string
  checkpoint: unknown | null
  variantSeed: string
  contentVersion: string
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await runPostHandler(request, response, async () => {
    const input = startAttemptRequestSchema.parse(request.body)
    const session = openToken<SessionTokenClaims>(input.sessionToken, 'session')
    if (input.student.classPeriod !== session.allowedPeriod) {
      throw new ApiError('PERIOD_MISMATCH', 'Choose the class period assigned to this session code.', 403)
    }

    const proposedVariantSeed = randomUUID()
    const attempt = attemptStartBridgeSchema.parse(await bridgeCall<AttemptStartResult>('attempt.start', {
      teacherSessionId: session.teacherSessionId,
      clientAttemptId: input.clientAttemptId,
      student: input.student,
      proposedVariantSeed,
      contentVersion: CONTENT_VERSION,
    }))
    if (attempt.contentVersion !== CONTENT_VERSION) {
      throw new ApiError(
        'CONTENT_VERSION_MISMATCH',
        'This saved attempt uses a different game version. Ask the teacher for help before continuing.',
        409,
      )
    }
    const attemptToken = sealToken({
      kind: 'attempt',
      issuedAt: Date.now(),
      expiresAt: session.expiresAt,
      teacherSessionId: session.teacherSessionId,
      attemptId: attempt.attemptId,
      studentKeyHash: attempt.studentKeyHash,
      classPeriod: input.student.classPeriod,
      variantSeed: attempt.variantSeed,
      contentVersion: attempt.contentVersion,
    })

    return {
      attemptToken,
      attemptId: attempt.attemptId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      checkpoint: attempt.checkpoint,
      contentVersion: attempt.contentVersion,
      variantManifest: toPublicVariantManifest(attempt.variantSeed),
    }
  })
}

function toPublicVariantManifest(seed: string): Record<string, unknown> {
  const manifest = buildAssessmentVariantManifest(seed)
  return {
    missions: manifest.missions.map((mission) => {
      const common = {
        id: mission.id,
        variantId: mission.variantId,
        kind: mission.kind,
        title: mission.title,
        prompt: mission.prompt,
        pointValue: mission.pointValue,
      }
      if (mission.kind === 'OBSERVE_ROUTE') return { ...common, route: mission.route }
      if (mission.kind === 'PLAN_ROUTE') return { ...common, board: mission.board }
      return {
        ...common,
        options: mission.options.map(({ id, label }) => ({ id, label })),
      }
    }),
  }
}
