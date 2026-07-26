import { buildPracticeSequence } from '../content/practice'
import { analyzeRoute } from '../domain/motion'
import type {
  DisplacementDirection,
  Mission,
  MissionResponse,
  MoveDirection,
  Route,
} from '../domain/types'
import { evaluateRouteConstraints } from '../domain/validation'
import type {
  CardinalDirection,
  GridPoint,
  MissionDefinition,
  NumberDirectionResponse,
  ProbeDefinition,
  PublicAssessmentMission,
  PublicVariantManifest,
  SubmissionResult,
} from './types'

const directionToUi: Record<DisplacementDirection, CardinalDirection> = {
  NORTH: 'north', EAST: 'east', SOUTH: 'south', WEST: 'west', NONE: 'none',
}

const directionToDomain: Record<CardinalDirection, DisplacementDirection> = {
  north: 'NORTH', east: 'EAST', south: 'SOUTH', west: 'WEST', none: 'NONE',
}

function routeBounds(points: readonly GridPoint[], width = 7, height = 5): { width: number; height: number } {
  return {
    width: Math.max(width, ...points.map((point) => point.x + 1)),
    height: Math.max(height, ...points.map((point) => point.y + 1)),
  }
}

function practiceToDefinition(mission: Mission): MissionDefinition | null {
  if (mission.kind === 'CONCEPT_PROBE') return null
  const authoredRoute = mission.kind === 'PLAN_ROUTE' ? mission.exampleSolution : mission.route
  const analysis = analyzeRoute(authoredRoute)
  if (analysis.displacement.direction === 'DIAGONAL') throw new Error(`${mission.id} has a diagonal endpoint.`)
  const board = mission.kind === 'PLAN_ROUTE' ? mission.board : null
  const bounds = routeBounds(analysis.visitedPoints, board?.width, board?.height)
  return {
    id: mission.id,
    variantId: mission.variantId,
    phase: 'practice',
    mode: mission.kind === 'PLAN_ROUTE' ? 'build' : 'fixed',
    eyebrow: 'Guided practice',
    title: mission.title,
    prompt: mission.prompt,
    route: {
      start: { ...authoredRoute.start },
      target: board ? { ...board.goal } : { ...analysis.end },
      points: analysis.visitedPoints.map((point) => ({ ...point })),
      requiredPoint: board?.checkpoints[0] ? { ...board.checkpoints[0] } : undefined,
      blockedPoints: board?.obstacles.map((point) => ({ ...point })),
      gridWidth: bounds.width,
      gridHeight: bounds.height,
      maxCommands: board?.maxCommands,
    },
    answer: {
      distance: analysis.distance,
      magnitude: analysis.displacement.magnitude,
      direction: directionToUi[analysis.displacement.direction],
    },
    hint: mission.id === 'P1'
      ? 'Distance never cancels. Add the east segment and the backtracking segment.'
      : mission.id === 'P2'
        ? 'Displacement compares START with FINISH. A zero vector has no direction.'
        : 'First make a valid route through CHECK. Then measure the path you actually built.',
    workedHint: `The route travels ${analysis.distance} m. Its displacement is ${analysis.displacement.magnitude} m ${directionToUi[analysis.displacement.direction]}.`,
    constraintLabel: board?.checkpoints.length ? 'Visit CHECK before FINISH.' : undefined,
  }
}

function publicToDefinition(mission: PublicAssessmentMission): MissionDefinition | null {
  if (mission.kind === 'CONCEPT_PROBE') return null
  if (mission.kind === 'OBSERVE_ROUTE') {
    const analysis = analyzeRoute(mission.route)
    if (analysis.displacement.direction === 'DIAGONAL') throw new Error(`${mission.id} has a diagonal endpoint.`)
    const bounds = routeBounds(analysis.visitedPoints)
    return {
      id: mission.id, variantId: mission.variantId, phase: 'assessment', mode: 'fixed',
      eyebrow: 'Scored voyage', title: mission.title, prompt: mission.prompt,
      route: {
        start: { ...mission.route.start }, target: { ...analysis.end },
        points: analysis.visitedPoints.map((point) => ({ ...point })),
        gridWidth: bounds.width, gridHeight: bounds.height,
      },
      hint: '', workedHint: '',
    }
  }

  return {
    id: mission.id, variantId: mission.variantId, phase: 'assessment', mode: 'build',
    eyebrow: 'Scored voyage', title: mission.title, prompt: mission.prompt,
    route: {
      start: { ...mission.board.start }, target: { ...mission.board.goal }, points: [{ ...mission.board.start }],
      requiredPoint: mission.board.checkpoints[0] ? { ...mission.board.checkpoints[0] } : undefined,
      blockedPoints: mission.board.obstacles.map((point) => ({ ...point })),
      gridWidth: mission.board.width, gridHeight: mission.board.height, maxCommands: mission.board.maxCommands,
    },
    hint: '', workedHint: '',
    constraintLabel: mission.board.checkpoints.length ? 'Visit CHECK before FINISH.' : 'Do not cross a closed square.',
  }
}

export interface GameContent {
  publicManifest: PublicVariantManifest
  guidedMissions: MissionDefinition[]
  assessmentMissions: MissionDefinition[]
  rapidProbes: ProbeDefinition[]
}

export function buildGameContent(practiceSeed: string, publicManifest: PublicVariantManifest): GameContent {
  return {
    publicManifest,
    guidedMissions: buildPracticeSequence(practiceSeed).map(practiceToDefinition).filter((mission): mission is MissionDefinition => mission !== null),
    assessmentMissions: publicManifest.missions.map(publicToDefinition).filter((mission): mission is MissionDefinition => mission !== null),
    rapidProbes: publicManifest.missions
      .filter((mission) => mission.kind === 'CONCEPT_PROBE')
      .map((mission) => ({
        id: mission.id as ProbeDefinition['id'], variantId: mission.variantId, prompt: mission.prompt,
        options: mission.options.map((option) => ({ value: option.id, label: option.label })),
      })),
  }
}

export function pointsToRoute(points: readonly GridPoint[]): Route {
  const start = points[0] ?? { x: 0, y: 0 }
  const moves: Array<{ direction: MoveDirection; units: number }> = []
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const direction: MoveDirection = current.x > previous.x ? 'EAST' : current.x < previous.x ? 'WEST' : current.y > previous.y ? 'NORTH' : 'SOUTH'
    const last = moves.at(-1)
    if (last?.direction === direction) last.units += 1
    else moves.push({ direction, units: 1 })
  }
  return { start, moves }
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildMissionResponses(
  manifest: PublicVariantManifest,
  assessmentResponses: Record<string, NumberDirectionResponse>,
  probeResponses: Record<string, string>,
  routes: Record<string, GridPoint[]>,
): MissionResponse[] {
  return manifest.missions.map((mission) => {
    if (mission.kind === 'CONCEPT_PROBE') {
      return { missionId: mission.id as MissionResponse['missionId'], variantId: mission.variantId, kind: 'CONCEPT', selectedOptionId: probeResponses[mission.id] || null }
    }
    const response = assessmentResponses[mission.id] ?? { distance: '', magnitude: '', direction: '' }
    const base = {
      missionId: mission.id as MissionResponse['missionId'], variantId: mission.variantId,
      distance: numberOrNull(response.distance), displacementMagnitude: numberOrNull(response.magnitude),
      displacementDirection: response.direction ? directionToDomain[response.direction] : null,
    }
    if (mission.kind === 'PLAN_ROUTE') return { ...base, kind: 'PLANNING', route: pointsToRoute(routes[mission.id] ?? [mission.board.start]) }
    return { ...base, kind: 'MEASUREMENT' }
  })
}

function postSubmitReview(manifest: PublicVariantManifest): SubmissionResult['review'] {
  return Object.fromEntries(manifest.missions.flatMap((mission) => {
    if (mission.kind === 'CONCEPT_PROBE') return []
    if (mission.kind === 'OBSERVE_ROUTE') {
      const analysis = analyzeRoute(mission.route)
      if (analysis.displacement.direction === 'DIAGONAL') return []
      return [[mission.id, {
        distance: analysis.distance,
        magnitude: analysis.displacement.magnitude,
        direction: directionToUi[analysis.displacement.direction],
      }]]
    }
    const dx = mission.board.goal.x - mission.board.start.x
    const dy = mission.board.goal.y - mission.board.start.y
    const direction: CardinalDirection = dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'north' : dy < 0 ? 'south' : 'none'
    return [[mission.id, { magnitude: Math.hypot(dx, dy), direction }]]
  }))
}

export function demoCompletionResult(manifest: PublicVariantManifest): SubmissionResult {
  return {
    score: null,
    maxScore: 20,
    percent: null,
    masteryTier: null,
    focus: 'Demo complete — classroom scoring was not used',
    responseStatus: {},
    review: postSubmitReview(manifest),
  }
}

export function practiceIsCorrect(mission: MissionDefinition, response: NumberDirectionResponse, points: GridPoint[]): boolean {
  const routeAnalysis = mission.mode === 'build' ? analyzeRoute(pointsToRoute(points)) : null
  const expected = routeAnalysis ? {
    distance: routeAnalysis.distance,
    magnitude: routeAnalysis.displacement.magnitude,
    direction: routeAnalysis.displacement.direction === 'DIAGONAL' ? '' : directionToUi[routeAnalysis.displacement.direction],
  } : mission.answer
  if (!expected) return false
  const board = mission.mode === 'build' ? {
    start: mission.route.start, goal: mission.route.target, width: mission.route.gridWidth, height: mission.route.gridHeight,
    checkpoints: mission.route.requiredPoint ? [mission.route.requiredPoint] : [], obstacles: mission.route.blockedPoints ?? [], maxCommands: mission.route.maxCommands ?? 30,
  } : null
  return (!board || evaluateRouteConstraints(pointsToRoute(points), board).valid)
    && Number(response.distance) === expected.distance
    && Number(response.magnitude) === expected.magnitude
    && response.direction === expected.direction
}
