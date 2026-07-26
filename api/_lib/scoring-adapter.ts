import { createHash } from 'node:crypto'
import { analyzeRoute, scoreAssessment } from '../../src/domain/index.js'
import type { AssessmentScore, MissionResponse } from '../../src/domain/index.js'
import {
  buildAssessmentVariantManifest,
  CONTENT_VERSION,
} from '../../src/content/index.js'
import { ApiError } from './errors.js'

export { CONTENT_VERSION }

export function scoreCanonicalAssessment(
  responses: readonly MissionResponse[],
  variantSeed: string,
): AssessmentScore {
  const manifest = buildAssessmentVariantManifest(variantSeed)
  const responseByMission = new Map(responses.map((response) => [response.missionId, response]))
  const mismatch = manifest.missions.find((mission) => {
    const response = responseByMission.get(mission.id)
    const expectedKind = mission.kind === 'OBSERVE_ROUTE'
      ? 'MEASUREMENT'
      : mission.kind === 'PLAN_ROUTE'
        ? 'PLANNING'
        : 'CONCEPT'
    return !response || response.variantId !== mission.variantId || response.kind !== expectedKind
  })
  if (mismatch) {
    throw new ApiError(
      'VARIANT_MISMATCH',
      'This saved answer does not match the assigned assessment version. Reload the attempt before submitting.',
      409,
    )
  }
  return scoreAssessment(responses, manifest)
}

export function hashCanonicalPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

export function studentResult(score: AssessmentScore, variantSeed: string): Record<string, unknown> {
  const manifest = buildAssessmentVariantManifest(variantSeed)
  const review = Object.fromEntries(manifest.missions.flatMap((mission) => {
    if (mission.kind === 'CONCEPT_PROBE') return []
    if (mission.kind === 'OBSERVE_ROUTE') {
      const expected = analyzeRoute(mission.route)
      if (expected.displacement.direction === 'DIAGONAL') return []
      return [[mission.id, {
        distance: expected.distance,
        magnitude: expected.displacement.magnitude,
        direction: expected.displacement.direction.toLowerCase(),
      }]]
    }
    const dx = mission.board.goal.x - mission.board.start.x
    const dy = mission.board.goal.y - mission.board.start.y
    const direction = dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'north' : dy < 0 ? 'south' : 'none'
    return [[mission.id, { magnitude: Math.hypot(dx, dy), direction }]]
  }))
  return {
    score: score.score,
    scoreMax: score.max,
    percent: score.percent,
    canvasGrade: score.score,
    directionScore: score.directionScore,
    directionMax: score.directionMax,
    c3Correct: score.c3Correct,
    rawTier: score.rawTier,
    masteryTier: score.masteryTier,
    masteryCapReason: score.capReason,
    itemResults: score.itemResults,
    misconceptions: score.misconceptions,
    review,
  }
}
