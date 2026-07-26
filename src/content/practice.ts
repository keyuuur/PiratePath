import type { Mission } from "../domain/types";
import { assertValidMissionBank } from "../domain/validation";
import { selectDeterministicVariant } from "../domain/variants";

export const PRACTICE_MISSION_BANKS = {
  P1: [
    {
      id: "P1",
      variantId: "P1-TRACE-EAST-01",
      phase: "PRACTICE",
      kind: "OBSERVE_ROUTE",
      title: "Trace and Count",
      prompt: "Trace every segment, including the return segment, to find total distance.",
      pointValue: 0,
      learningObjectives: ["LO1_DISTANCE", "LO6_UNITS"],
      misconceptionTargets: ["STRAIGHT_LINE_AS_DISTANCE", "RETURN_SEGMENTS_CANCEL_DISTANCE"],
      route: { start: { x: 1, y: 1 }, moves: [{ direction: "EAST", units: 4 }, { direction: "WEST", units: 1 }] },
    },
    {
      id: "P1",
      variantId: "P1-TRACE-WEST-02",
      phase: "PRACTICE",
      kind: "OBSERVE_ROUTE",
      title: "Trace and Count",
      prompt: "Trace every segment, including the return segment, to find total distance.",
      pointValue: 0,
      learningObjectives: ["LO1_DISTANCE", "LO6_UNITS"],
      misconceptionTargets: ["STRAIGHT_LINE_AS_DISTANCE", "RETURN_SEGMENTS_CANCEL_DISTANCE"],
      route: { start: { x: 6, y: 1 }, moves: [{ direction: "WEST", units: 5 }, { direction: "EAST", units: 2 }] },
    },
  ],
  P2: [
    {
      id: "P2",
      variantId: "P2-VECTOR-NORTH-01",
      phase: "PRACTICE",
      kind: "OBSERVE_ROUTE",
      title: "Place the Vector",
      prompt: "Place the displacement arrow from start to finish, then report magnitude and direction.",
      pointValue: 0,
      learningObjectives: ["LO2_VECTOR", "LO6_UNITS"],
      misconceptionTargets: ["PATH_AS_DISPLACEMENT", "FINAL_COORDINATE_AS_DISPLACEMENT", "DIRECTION_OMITTED", "DIRECTION_REVERSED"],
      route: { start: { x: 3, y: 1 }, moves: [{ direction: "NORTH", units: 4 }] },
    },
    {
      id: "P2",
      variantId: "P2-VECTOR-SOUTH-02",
      phase: "PRACTICE",
      kind: "OBSERVE_ROUTE",
      title: "Place the Vector",
      prompt: "Place the displacement arrow from start to finish, then report magnitude and direction.",
      pointValue: 0,
      learningObjectives: ["LO2_VECTOR", "LO6_UNITS"],
      misconceptionTargets: ["PATH_AS_DISPLACEMENT", "FINAL_COORDINATE_AS_DISPLACEMENT", "DIRECTION_OMITTED", "DIRECTION_REVERSED"],
      route: { start: { x: 4, y: 5 }, moves: [{ direction: "SOUTH", units: 3 }] },
    },
  ],
  P3: [
    {
      id: "P3",
      variantId: "P3-PLAN-EAST-01",
      phase: "PRACTICE",
      kind: "PLAN_ROUTE",
      title: "Plan, Predict, Launch",
      prompt: "Plan a detour to the goal, predict both measurements, and launch the route.",
      pointValue: 0,
      learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO4_COMPARE_ROUTES", "LO5_PLAN_ROUTE", "LO6_UNITS"],
      misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT"],
      board: { width: 6, height: 4, start: { x: 0, y: 1 }, goal: { x: 5, y: 1 }, checkpoints: [{ x: 2, y: 3 }], obstacles: [], maxCommands: 4 },
      exampleSolution: { start: { x: 0, y: 1 }, moves: [{ direction: "NORTH", units: 2 }, { direction: "EAST", units: 5 }, { direction: "SOUTH", units: 2 }] },
    },
    {
      id: "P3",
      variantId: "P3-PLAN-WEST-02",
      phase: "PRACTICE",
      kind: "PLAN_ROUTE",
      title: "Plan, Predict, Launch",
      prompt: "Plan a detour to the goal, predict both measurements, and launch the route.",
      pointValue: 0,
      learningObjectives: ["LO1_DISTANCE", "LO2_VECTOR", "LO4_COMPARE_ROUTES", "LO5_PLAN_ROUTE", "LO6_UNITS"],
      misconceptionTargets: ["PATH_AS_DISPLACEMENT", "LONGER_PATH_MEANS_LARGER_DISPLACEMENT"],
      board: { width: 6, height: 4, start: { x: 5, y: 2 }, goal: { x: 0, y: 2 }, checkpoints: [{ x: 3, y: 0 }], obstacles: [], maxCommands: 4 },
      exampleSolution: { start: { x: 5, y: 2 }, moves: [{ direction: "SOUTH", units: 2 }, { direction: "WEST", units: 5 }, { direction: "NORTH", units: 2 }] },
    },
  ],
} as const satisfies Readonly<Record<"P1" | "P2" | "P3", readonly Mission[]>>;

export const PRACTICE_MISSION_ORDER = ["P1", "P2", "P3"] as const;

export function buildPracticeSequence(seed: string): readonly Mission[] {
  return PRACTICE_MISSION_ORDER.map((id) => {
    const bank = PRACTICE_MISSION_BANKS[id] as readonly Mission[];
    return selectDeterministicVariant<Mission>(seed, id, bank);
  });
}

export function assertValidPracticeContent(): void {
  Object.values(PRACTICE_MISSION_BANKS).forEach((bank) => assertValidMissionBank(bank as readonly Mission[]));
}
