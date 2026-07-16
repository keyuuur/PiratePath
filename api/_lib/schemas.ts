import { z } from 'zod'

export const classPeriodSchema = z.enum([
  '1st hour',
  '2nd hour',
  '3rd hour',
  '4th hour',
  '5th hour',
  '6th hour',
  '7th hour',
])

const nonEmptyText = z.string().trim().min(1).max(80)
const missionIdSchema = z.enum(['A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3'])
const moveDirectionSchema = z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST'])
const displacementDirectionSchema = z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST', 'NONE'])

const pointSchema = z.object({
  x: z.number().int().min(-100).max(100),
  y: z.number().int().min(-100).max(100),
})

const routeSchema = z.object({
  start: pointSchema,
  moves: z.array(z.object({
    direction: moveDirectionSchema,
    units: z.number().int().positive().max(50),
  })).max(30),
})

const responseBase = {
  missionId: missionIdSchema,
  variantId: z.string().trim().min(1).max(100),
}

const measurementResponseSchema = z.object({
  ...responseBase,
  kind: z.literal('MEASUREMENT'),
  distance: z.number().finite().nonnegative().max(10_000).nullable(),
  displacementMagnitude: z.number().finite().nonnegative().max(10_000).nullable(),
  displacementDirection: displacementDirectionSchema.nullable(),
})

const planningResponseSchema = z.object({
  ...responseBase,
  kind: z.literal('PLANNING'),
  distance: z.number().finite().nonnegative().max(10_000).nullable(),
  displacementMagnitude: z.number().finite().nonnegative().max(10_000).nullable(),
  displacementDirection: displacementDirectionSchema.nullable(),
  route: routeSchema,
})

const conceptResponseSchema = z.object({
  ...responseBase,
  kind: z.literal('CONCEPT'),
  selectedOptionId: z.string().trim().min(1).max(100).nullable(),
})

export const missionResponseSchema = z.discriminatedUnion('kind', [
  measurementResponseSchema,
  planningResponseSchema,
  conceptResponseSchema,
])

export const validateSessionRequestSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  classPeriod: classPeriodSchema,
})

export const startAttemptRequestSchema = z.object({
  sessionToken: z.string().min(20).max(4096),
  clientAttemptId: z.string().uuid(),
  student: z.object({
    firstName: nonEmptyText,
    lastName: nonEmptyText,
    classPeriod: classPeriodSchema,
  }),
})

export const checkpointRequestSchema = z.object({
  attemptToken: z.string().min(20).max(4096),
  attemptId: z.string().uuid(),
  stateVersion: z.number().int().positive().max(100),
  currentMissionId: z.enum(['P1', 'P2', 'P3', 'A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3']),
  completedMissionIds: z.array(z.enum(['P1', 'P2', 'P3', 'A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3'])).max(11),
  responses: z.array(missionResponseSchema).max(8),
  updatedAt: z.string().datetime({ offset: true }),
})

export const submitAttemptRequestSchema = z.object({
  attemptToken: z.string().min(20).max(4096),
  attemptId: z.string().uuid(),
  appVersion: z.string().trim().min(1).max(100),
  contentVersion: z.string().trim().min(1).max(100),
  startedAt: z.string().datetime({ offset: true }),
  submittedAt: z.string().datetime({ offset: true }),
  responses: z.array(missionResponseSchema).length(8),
}).superRefine((value, context) => {
  const ids = value.responses.map((response) => response.missionId)
  const expected = ['A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3']
  if (new Set(ids).size !== expected.length || expected.some((id) => !ids.includes(id as typeof ids[number]))) {
    context.addIssue({
      code: 'custom',
      path: ['responses'],
      message: 'Assessment responses must contain A1-A5 and C1-C3 exactly once.',
    })
  }
  value.responses.forEach((response, index) => {
    const path = ['responses', index]
    if (['A1', 'A2', 'A3'].includes(response.missionId) && response.kind !== 'MEASUREMENT') {
      context.addIssue({ code: 'custom', path: [...path, 'kind'], message: `${response.missionId} requires a measurement response.` })
    }
    if (['A4', 'A5'].includes(response.missionId) && response.kind !== 'PLANNING') {
      context.addIssue({ code: 'custom', path: [...path, 'kind'], message: `${response.missionId} requires a planned route.` })
    }
    if (['C1', 'C2', 'C3'].includes(response.missionId) && response.kind !== 'CONCEPT') {
      context.addIssue({ code: 'custom', path: [...path, 'kind'], message: `${response.missionId} requires a concept answer.` })
    }
    if (response.kind === 'CONCEPT') {
      if (response.selectedOptionId === null) {
        context.addIssue({ code: 'custom', path: [...path, 'selectedOptionId'], message: 'Choose an answer before final submission.' })
      }
      return
    }
    if (response.distance === null) {
      context.addIssue({ code: 'custom', path: [...path, 'distance'], message: 'Distance is required before final submission.' })
    }
    if (response.displacementMagnitude === null) {
      context.addIssue({ code: 'custom', path: [...path, 'displacementMagnitude'], message: 'Displacement magnitude is required before final submission.' })
    }
    if (response.displacementDirection === null) {
      context.addIssue({ code: 'custom', path: [...path, 'displacementDirection'], message: 'Displacement direction is required before final submission.' })
    }
    if (response.kind === 'PLANNING' && response.route.moves.length === 0) {
      context.addIssue({ code: 'custom', path: [...path, 'route', 'moves'], message: 'Build a route before final submission.' })
    }
  })
})

export const sessionValidationBridgeSchema = z.object({
  teacherSessionId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  allowedPeriod: classPeriodSchema,
  closesAt: z.string().datetime({ offset: true }),
})

export const attemptStartBridgeSchema = z.object({
  attemptId: z.string().uuid(),
  studentKeyHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal('in_progress'),
  startedAt: z.string().datetime({ offset: true }),
  checkpoint: z.unknown().nullable(),
  variantSeed: z.string().uuid(),
  contentVersion: z.string().trim().min(1).max(100),
})

export const checkpointBridgeSchema = z.object({
  saved: z.boolean(),
  duplicate: z.boolean(),
  stale: z.boolean(),
  stateVersion: z.number().int().positive(),
  updatedAt: z.string().datetime({ offset: true }),
})

export const submitBridgeSchema = z.object({
  duplicate: z.boolean(),
  submittedAt: z.string().datetime({ offset: true }),
})
