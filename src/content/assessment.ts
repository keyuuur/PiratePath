import type {
  AssessmentMission,
  AssessmentMissionId,
  AssessmentVariantManifest,
  Mission,
} from "../domain/types";
import { assertValidAssessmentForm, assertValidMissionBank } from "../domain/validation";
import { selectDeterministicVariant } from "../domain/variants";

const A1_VARIANTS = [
  {
    id: "A1",
    variantId: "A1-EAST-01",
    phase: "ASSESSMENT",
    kind: "OBSERVE_ROUTE",
    title: "Reversal Run",
    prompt: "Watch the pirate reverse direction. Report distance and displacement with direction.",
    pointValue: 3,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO6_UNITS"],
    misconceptionTargets: ["STRAIGHT_LINE_AS_DISTANCE", "RETURN_SEGMENTS_CANCEL_DISTANCE", "DIRECTION_OMITTED", "DIRECTION_REVERSED"],
    route: { start: { x: 2, y: 1 }, moves: [{ direction: "EAST", units: 5 }, { direction: "WEST", units: 2 }] },
  },
  {
    id: "A1",
    variantId: "A1-WEST-02",
    phase: "ASSESSMENT",
    kind: "OBSERVE_ROUTE",
    title: "Reversal Run",
    prompt: "Watch the pirate reverse direction. Report distance and displacement with direction.",
    pointValue: 3,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO6_UNITS"],
    misconceptionTargets: ["STRAIGHT_LINE_AS_DISTANCE", "RETURN_SEGMENTS_CANCEL_DISTANCE", "DIRECTION_OMITTED", "DIRECTION_REVERSED"],
    route: { start: { x: 7, y: 2 }, moves: [{ direction: "WEST", units: 4 }, { direction: "EAST", units: 1 }] },
  },
] as const satisfies readonly AssessmentMission[];

const A2_VARIANTS = [
  {
    id: "A2",
    variantId: "A2-ZERO-01",
    phase: "ASSESSMENT",
    kind: "OBSERVE_ROUTE",
    title: "Back to the Dock",
    prompt: "The pirate returns to the start. Report distance and displacement with direction.",
    pointValue: 3,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO3_ZERO_DISPLACEMENT", "LO6_UNITS"],
    misconceptionTargets: ["RETURN_SEGMENTS_CANCEL_DISTANCE", "ZERO_DISPLACEMENT_MEANS_NO_MOTION", "ZERO_VECTOR_HAS_DIRECTION"],
    route: { start: { x: 1, y: 1 }, moves: [{ direction: "EAST", units: 4 }, { direction: "WEST", units: 4 }] },
  },
  {
    id: "A2",
    variantId: "A2-ZERO-02",
    phase: "ASSESSMENT",
    kind: "OBSERVE_ROUTE",
    title: "Back to the Dock",
    prompt: "The pirate returns to the start. Report distance and displacement with direction.",
    pointValue: 3,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO3_ZERO_DISPLACEMENT", "LO6_UNITS"],
    misconceptionTargets: ["RETURN_SEGMENTS_CANCEL_DISTANCE", "ZERO_DISPLACEMENT_MEANS_NO_MOTION", "ZERO_VECTOR_HAS_DIRECTION"],
    route: { start: { x: 5, y: 2 }, moves: [{ direction: "WEST", units: 3 }, { direction: "EAST", units: 3 }] },
  },
] as const satisfies readonly AssessmentMission[];

const A3_VARIANTS = [
  {
    id: "A3",
    variantId: "A3-EAST-01",
    phase: "ASSESSMENT",
    kind: "OBSERVE_ROUTE",
    title: "School Detour",
    prompt: "Follow the two-dimensional detour. Report distance and displacement with direction.",
    pointValue: 3,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO6_UNITS"],
    misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT", "DIRECTION_OMITTED"],
    route: { start: { x: 1, y: 1 }, moves: [{ direction: "NORTH", units: 2 }, { direction: "EAST", units: 4 }, { direction: "SOUTH", units: 2 }] },
  },
  {
    id: "A3",
    variantId: "A3-WEST-02",
    phase: "ASSESSMENT",
    kind: "OBSERVE_ROUTE",
    title: "School Detour",
    prompt: "Follow the two-dimensional detour. Report distance and displacement with direction.",
    pointValue: 3,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO6_UNITS"],
    misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT", "DIRECTION_OMITTED"],
    route: { start: { x: 5, y: 1 }, moves: [{ direction: "NORTH", units: 3 }, { direction: "WEST", units: 3 }, { direction: "SOUTH", units: 3 }] },
  },
] as const satisfies readonly AssessmentMission[];

const A4_VARIANTS = [
  {
    id: "A4",
    variantId: "A4-CHECKPOINT-EAST-01",
    phase: "ASSESSMENT",
    kind: "PLAN_ROUTE",
    title: "Checkpoint Plan",
    prompt: "Plan a route through the checkpoint to the goal, then predict its measurements.",
    pointValue: 4,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO5_PLAN_ROUTE", "LO6_UNITS"],
    misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT", "DIRECTION_OMITTED"],
    board: {
      width: 7,
      height: 5,
      start: { x: 0, y: 0 },
      goal: { x: 5, y: 0 },
      checkpoints: [{ x: 2, y: 2 }],
      obstacles: [],
      maxCommands: 4,
    },
    exampleSolution: { start: { x: 0, y: 0 }, moves: [{ direction: "NORTH", units: 2 }, { direction: "EAST", units: 5 }, { direction: "SOUTH", units: 2 }] },
  },
  {
    id: "A4",
    variantId: "A4-CHECKPOINT-WEST-02",
    phase: "ASSESSMENT",
    kind: "PLAN_ROUTE",
    title: "Checkpoint Plan",
    prompt: "Plan a route through the checkpoint to the goal, then predict its measurements.",
    pointValue: 4,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO5_PLAN_ROUTE", "LO6_UNITS"],
    misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT", "DIRECTION_OMITTED"],
    board: {
      width: 7,
      height: 5,
      start: { x: 6, y: 4 },
      goal: { x: 1, y: 4 },
      checkpoints: [{ x: 4, y: 2 }],
      obstacles: [],
      maxCommands: 4,
    },
    exampleSolution: { start: { x: 6, y: 4 }, moves: [{ direction: "SOUTH", units: 2 }, { direction: "WEST", units: 5 }, { direction: "NORTH", units: 2 }] },
  },
] as const satisfies readonly AssessmentMission[];

const A5_VARIANTS = [
  {
    id: "A5",
    variantId: "A5-OBSTACLE-EAST-01",
    phase: "ASSESSMENT",
    kind: "PLAN_ROUTE",
    title: "Obstacle Plan",
    prompt: "Plan a route around the blocked hall to the goal, then predict its measurements.",
    pointValue: 4,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO5_PLAN_ROUTE", "LO6_UNITS"],
    misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT", "DIRECTION_OMITTED"],
    board: {
      width: 7,
      height: 5,
      start: { x: 0, y: 2 },
      goal: { x: 6, y: 2 },
      checkpoints: [],
      obstacles: [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }],
      maxCommands: 4,
    },
    exampleSolution: { start: { x: 0, y: 2 }, moves: [{ direction: "NORTH", units: 2 }, { direction: "EAST", units: 6 }, { direction: "SOUTH", units: 2 }] },
  },
  {
    id: "A5",
    variantId: "A5-OBSTACLE-WEST-02",
    phase: "ASSESSMENT",
    kind: "PLAN_ROUTE",
    title: "Obstacle Plan",
    prompt: "Plan a route around the blocked hall to the goal, then predict its measurements.",
    pointValue: 4,
    learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO5_PLAN_ROUTE", "LO6_UNITS"],
    misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT", "DIRECTION_OMITTED"],
    board: {
      width: 7,
      height: 5,
      start: { x: 6, y: 2 },
      goal: { x: 0, y: 2 },
      checkpoints: [],
      obstacles: [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }],
      maxCommands: 4,
    },
    exampleSolution: { start: { x: 6, y: 2 }, moves: [{ direction: "SOUTH", units: 2 }, { direction: "WEST", units: 6 }, { direction: "NORTH", units: 2 }] },
  },
] as const satisfies readonly AssessmentMission[];

const C1_VARIANTS = [
  {
    id: "C1",
    variantId: "C1-DISTANCE-01",
    phase: "ASSESSMENT",
    kind: "CONCEPT_PROBE",
    title: "Distance Check",
    prompt: "Which statement correctly describes distance?",
    pointValue: 1,
    learningObjectives: ["LO1_DISTANCE"],
    misconceptionTargets: ["STRAIGHT_LINE_AS_DISTANCE", "RETURN_SEGMENTS_CANCEL_DISTANCE"],
    options: [
      { id: "A", label: "Distance is the straight line from start to finish.", misconceptionCode: "STRAIGHT_LINE_AS_DISTANCE" },
      { id: "B", label: "Distance is the total length of every segment traveled." },
      { id: "C", label: "Distance subtracts any segment traveled back toward the start.", misconceptionCode: "RETURN_SEGMENTS_CANCEL_DISTANCE" },
    ],
    correctOptionId: "B",
    explanation: "Distance adds every part of the route, including any backtracking.",
  },
  {
    id: "C1",
    variantId: "C1-DISTANCE-02",
    phase: "ASSESSMENT",
    kind: "CONCEPT_PROBE",
    title: "Distance Check",
    prompt: "A pirate walks out and partway back. How is distance found?",
    pointValue: 1,
    learningObjectives: ["LO1_DISTANCE"],
    misconceptionTargets: ["STRAIGHT_LINE_AS_DISTANCE", "RETURN_SEGMENTS_CANCEL_DISTANCE"],
    options: [
      { id: "A", label: "Subtract the return trip.", misconceptionCode: "RETURN_SEGMENTS_CANCEL_DISTANCE" },
      { id: "B", label: "Use only the start and finish.", misconceptionCode: "STRAIGHT_LINE_AS_DISTANCE" },
      { id: "C", label: "Add the outward and return segments." },
    ],
    correctOptionId: "C",
    explanation: "Every traveled segment contributes positively to distance.",
  },
] as const satisfies readonly AssessmentMission[];

const C2_VARIANTS = [
  {
    id: "C2",
    variantId: "C2-ENDPOINTS-01",
    phase: "ASSESSMENT",
    kind: "CONCEPT_PROBE",
    title: "Same Endpoints",
    prompt: "Two routes have the same start and finish. What must be true?",
    pointValue: 1,
    learningObjectives: ["LO4_COMPARE_ROUTES"],
    misconceptionTargets: ["SAME_ENDPOINTS_MEAN_SAME_DISTANCE", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT"],
    options: [
      { id: "A", label: "They must have the same distance.", misconceptionCode: "SAME_ENDPOINTS_MEAN_SAME_DISTANCE" },
      { id: "B", label: "They have the same displacement, but their distances can differ." },
      { id: "C", label: "The longer route has greater displacement.", misconceptionCode: "LONGER_PATH_MEANS_LARGER_DISPLACEMENT" },
    ],
    correctOptionId: "B",
    explanation: "Displacement depends only on the shared start and finish; distance depends on each path.",
  },
  {
    id: "C2",
    variantId: "C2-ENDPOINTS-02",
    phase: "ASSESSMENT",
    kind: "CONCEPT_PROBE",
    title: "Same Endpoints",
    prompt: "One route is direct and one detours, but both share endpoints. Choose the correct comparison.",
    pointValue: 1,
    learningObjectives: ["LO4_COMPARE_ROUTES"],
    misconceptionTargets: ["SAME_ENDPOINTS_MEAN_SAME_DISTANCE", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT"],
    options: [
      { id: "A", label: "Same displacement; the detour can have more distance." },
      { id: "B", label: "Same distance and same displacement.", misconceptionCode: "SAME_ENDPOINTS_MEAN_SAME_DISTANCE" },
      { id: "C", label: "The detour has more displacement.", misconceptionCode: "LONGER_PATH_MEANS_LARGER_DISPLACEMENT" },
    ],
    correctOptionId: "A",
    explanation: "Changing the path changes distance, not the displacement between unchanged endpoints.",
  },
] as const satisfies readonly AssessmentMission[];

const C3_VARIANTS = [
  {
    id: "C3",
    variantId: "C3-ZERO-01",
    phase: "ASSESSMENT",
    kind: "CONCEPT_PROBE",
    title: "Zero Displacement",
    prompt: "A pirate travels 10 m and finishes at the start. What is the displacement?",
    pointValue: 1,
    learningObjectives: ["LO3_ZERO_DISPLACEMENT"],
    misconceptionTargets: ["ZERO_DISPLACEMENT_MEANS_NO_MOTION", "ZERO_VECTOR_HAS_DIRECTION"],
    options: [
      { id: "A", label: "0 m is impossible because the pirate moved", misconceptionCode: "ZERO_DISPLACEMENT_MEANS_NO_MOTION" },
      { id: "B", label: "0 m with no direction" },
      { id: "C", label: "0 m east", misconceptionCode: "ZERO_VECTOR_HAS_DIRECTION" },
    ],
    correctOptionId: "B",
    explanation: "The start and finish are identical, so the displacement vector is zero and has no direction.",
  },
  {
    id: "C3",
    variantId: "C3-ZERO-02",
    phase: "ASSESSMENT",
    kind: "CONCEPT_PROBE",
    title: "Zero Displacement",
    prompt: "A pirate takes a round trip and travels a nonzero distance. Which statement is correct?",
    pointValue: 1,
    learningObjectives: ["LO3_ZERO_DISPLACEMENT"],
    misconceptionTargets: ["ZERO_DISPLACEMENT_MEANS_NO_MOTION", "ZERO_VECTOR_HAS_DIRECTION"],
    options: [
      { id: "A", label: "The displacement is 0 m with no direction" },
      { id: "B", label: "Zero displacement is possible only with no movement", misconceptionCode: "ZERO_DISPLACEMENT_MEANS_NO_MOTION" },
      { id: "C", label: "The displacement is 0 m east because the final leg was east", misconceptionCode: "ZERO_VECTOR_HAS_DIRECTION" },
    ],
    correctOptionId: "A",
    explanation: "A complete round trip has traveled distance but no change in position.",
  },
] as const satisfies readonly AssessmentMission[];

export const ASSESSMENT_MISSION_BANKS: Readonly<Record<AssessmentMissionId, readonly AssessmentMission[]>> = {
  A1: A1_VARIANTS,
  A2: A2_VARIANTS,
  A3: A3_VARIANTS,
  A4: A4_VARIANTS,
  A5: A5_VARIANTS,
  C1: C1_VARIANTS,
  C2: C2_VARIANTS,
  C3: C3_VARIANTS,
};

export const ASSESSMENT_MISSION_ORDER = ["A1", "A2", "A3", "A4", "A5", "C1", "C2", "C3"] as const;

export function buildAssessmentVariantManifest(seed: string): AssessmentVariantManifest {
  const missions = ASSESSMENT_MISSION_ORDER.map((id) =>
    selectDeterministicVariant(seed, id, ASSESSMENT_MISSION_BANKS[id]),
  );
  assertValidAssessmentForm(missions);
  return { seed, missions };
}

export function assertValidAssessmentContent(): void {
  Object.values(ASSESSMENT_MISSION_BANKS).forEach((bank) => assertValidMissionBank(bank as readonly Mission[]));
  assertValidAssessmentForm(buildAssessmentVariantManifest("content-validation").missions);
}
