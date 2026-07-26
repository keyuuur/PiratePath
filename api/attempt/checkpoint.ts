import type { VercelRequest, VercelResponse } from '../_lib/vercel-types.js'
import { bridgeCall } from '../_lib/bridge.js'
import { ApiError } from '../_lib/errors.js'
import { runPostHandler } from '../_lib/http.js'
import { checkpointBridgeSchema, checkpointRequestSchema } from '../_lib/schemas.js'
import { openToken, type AttemptTokenClaims } from '../_lib/tokens.js'

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await runPostHandler(request, response, async () => {
    const input = checkpointRequestSchema.parse(request.body)
    const token = openToken<AttemptTokenClaims>(input.attemptToken, 'attempt')
    if (input.attemptId !== token.attemptId) {
      throw new ApiError('ATTEMPT_MISMATCH', 'This saved game does not match the active attempt.', 409)
    }

    const checkpoint = {
      stateVersion: input.stateVersion,
      currentMissionId: input.currentMissionId,
      completedMissionIds: input.completedMissionIds,
      responses: input.responses,
      updatedAt: input.updatedAt,
    }
    return checkpointBridgeSchema.parse(await bridgeCall('attempt.checkpoint', {
      teacherSessionId: token.teacherSessionId,
      attemptId: token.attemptId,
      studentKeyHash: token.studentKeyHash,
      checkpoint,
    }))
  })
}
