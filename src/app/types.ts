export type CardinalDirection = 'north' | 'east' | 'south' | 'west' | 'none'

export interface GridPoint {
  x: number
  y: number
}

export interface RouteDefinition {
  start: GridPoint
  target: GridPoint
  points: GridPoint[]
  gridWidth: number
  gridHeight: number
  maxCommands?: number
  requiredPoint?: GridPoint
  blockedPoints?: GridPoint[]
}

export interface NumberDirectionResponse {
  distance: string
  magnitude: string
  direction: CardinalDirection | ''
}

export interface MissionAnswer {
  distance?: number
  magnitude: number
  direction: CardinalDirection
}

export interface MissionDefinition {
  id: string
  variantId: string
  phase: 'practice' | 'assessment'
  mode: 'fixed' | 'build'
  eyebrow: string
  title: string
  prompt: string
  route: RouteDefinition
  answer?: MissionAnswer
  hint: string
  workedHint: string
  constraintLabel?: string
}

export interface ProbeDefinition {
  id: 'C1' | 'C2' | 'C3'
  variantId: string
  prompt: string
  options: Array<{ value: string; label: string }>
}

export type AppScreen =
  | 'join'
  | 'briefing'
  | 'practice'
  | 'readiness'
  | 'assessment'
  | 'rapid'
  | 'review'
  | 'submitting'
  | 'results'

export interface StudentIdentity {
  firstName: string
  lastName: string
  classPeriod: string
  sessionCode: string
}

export interface SavedRoute {
  missionId: string
  points: GridPoint[]
}

export interface CheckpointState {
  version: 2
  screen: Exclude<AppScreen, 'join' | 'submitting'>
  practiceIndex: number
  assessmentIndex: number
  practiceResponses: Record<string, NumberDirectionResponse>
  assessmentResponses: Record<string, NumberDirectionResponse>
  probeResponses: Record<string, string>
  savedRoutes: Record<string, GridPoint[]>
  reducedMotion: boolean
  muted: boolean
  startedAt: string
  attemptId: string
  attemptToken: string
  practiceSeed: string
  contentVersion: string
  mode: 'demo' | 'live'
  publicManifest: PublicVariantManifest
  submissionLocked: boolean
  finalResult?: SubmissionResult
}

export interface SubmissionResult {
  score: number | null
  maxScore: 20
  percent: number | null
  masteryTier: 1 | 2 | 3 | 4 | 5 | null
  focus: string
  responseStatus: Record<string, boolean>
  review: Record<string, MissionAnswer>
}

export interface PublicMissionBase {
  id: string
  variantId: string
  kind: 'OBSERVE_ROUTE' | 'PLAN_ROUTE' | 'CONCEPT_PROBE'
  title: string
  prompt: string
  pointValue: number
}

export interface PublicObserveMission extends PublicMissionBase {
  kind: 'OBSERVE_ROUTE'
  route: import('../domain/types').Route
}

export interface PublicPlanningMission extends PublicMissionBase {
  kind: 'PLAN_ROUTE'
  board: import('../domain/types').BoardDefinition
}

export interface PublicConceptMission extends PublicMissionBase {
  kind: 'CONCEPT_PROBE'
  options: Array<{ id: string; label: string }>
}

export type PublicAssessmentMission = PublicObserveMission | PublicPlanningMission | PublicConceptMission

export interface PublicVariantManifest {
  missions: PublicAssessmentMission[]
}

export interface JoinResult {
  attemptId: string
  mode: 'demo' | 'live'
  publicManifest: PublicVariantManifest
  resumed: boolean
}
