import type { VercelRequest, VercelResponse } from '../_lib/vercel-types.js'
import { bridgeCall } from '../_lib/bridge.js'
import { runPostHandler } from '../_lib/http.js'
import { validateSessionRequestSchema } from '../_lib/schemas.js'
import { sessionValidationBridgeSchema } from '../_lib/schemas.js'
import { sealToken } from '../_lib/tokens.js'

type SessionValidationResult = {
  teacherSessionId: string
  label: string
  allowedPeriod: string
  closesAt: string
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await runPostHandler(request, response, async () => {
    const input = validateSessionRequestSchema.parse(request.body)
    const session = sessionValidationBridgeSchema.parse(
      await bridgeCall<SessionValidationResult>('session.validate', input),
    )
    const closesAt = new Date(session.closesAt).getTime()
    if (!Number.isFinite(closesAt) || closesAt <= Date.now()) {
      throw new Error('The bridge returned an invalid session closing time.')
    }
    const expiresAt = Math.min(closesAt, Date.now() + 2 * 60 * 60 * 1000)
    const sessionToken = sealToken({
      kind: 'session',
      issuedAt: Date.now(),
      expiresAt,
      teacherSessionId: session.teacherSessionId,
      allowedPeriod: session.allowedPeriod,
    })
    return {
      sessionToken,
      label: session.label,
      allowedPeriod: session.allowedPeriod,
      closesAt: session.closesAt,
    }
  })
}
