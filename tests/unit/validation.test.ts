import { describe, expect, it } from "vitest";
import { ASSESSMENT_MISSION_BANKS, PRACTICE_MISSION_BANKS } from "../../src/content";
import {
  evaluateRouteConstraints,
  validateMission,
  validateMissionBank,
  type ObservationMission,
  type PlanningMission,
} from "../../src/domain";

describe("scenario validation", () => {
  it("accepts the authored checkpoint and obstacle solutions", () => {
    for (const bank of [ASSESSMENT_MISSION_BANKS.A4, ASSESSMENT_MISSION_BANKS.A5]) {
      for (const mission of bank) {
        if (mission.kind !== "PLAN_ROUTE") throw new Error("Expected planning mission.");
        expect(evaluateRouteConstraints(mission.exampleSolution, mission.board)).toMatchObject({ valid: true });
      }
    }
  });

  it("detects a missed checkpoint", () => {
    const mission = ASSESSMENT_MISSION_BANKS.A4[0] as PlanningMission;
    const result = evaluateRouteConstraints(
      { start: mission.board.start, moves: [{ direction: "EAST", units: 5 }] },
      mission.board,
    );
    expect(result.valid).toBe(false);
    expect(result.reachesGoal).toBe(true);
    expect(result.checkpointsVisitedInOrder).toBe(false);
  });

  it("detects obstacle collisions one grid cell at a time", () => {
    const mission = ASSESSMENT_MISSION_BANKS.A5[0] as PlanningMission;
    const result = evaluateRouteConstraints(
      { start: mission.board.start, moves: [{ direction: "EAST", units: 6 }] },
      mission.board,
    );
    expect(result.valid).toBe(false);
    expect(result.avoidsObstacles).toBe(false);
  });

  it("detects out-of-bounds movement and command-limit violations", () => {
    const mission = ASSESSMENT_MISSION_BANKS.A4[0] as PlanningMission;
    const result = evaluateRouteConstraints(
      {
        start: mission.board.start,
        moves: [
          { direction: "SOUTH", units: 1 },
          { direction: "NORTH", units: 1 },
          { direction: "EAST", units: 1 },
          { direction: "WEST", units: 1 },
          { direction: "EAST", units: 5 },
        ],
      },
      mission.board,
    );
    expect(result.staysInBounds).toBe(false);
    expect(result.withinCommandLimit).toBe(false);
  });

  it("rejects diagonal assessment displacement", () => {
    const base = ASSESSMENT_MISSION_BANKS.A1[0] as ObservationMission;
    const invalid: ObservationMission = {
      ...base,
      variantId: "INVALID-DIAGONAL",
      route: {
        start: { x: 0, y: 0 },
        moves: [{ direction: "EAST", units: 3 }, { direction: "NORTH", units: 4 }],
      },
    };
    expect(validateMission(invalid)).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/cardinal or zero/i) })]));
  });

  it("rejects banks whose variants are not equivalent", () => {
    const first = ASSESSMENT_MISSION_BANKS.A1[0];
    const mismatched = { ...ASSESSMENT_MISSION_BANKS.A2[0], pointValue: 2 };
    expect(validateMissionBank([first, mismatched])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/equivalent variants/i) })]),
    );
  });

  it("accepts mirrored and numerically different variants with the same cognitive structure", () => {
    for (const bank of [...Object.values(PRACTICE_MISSION_BANKS), ...Object.values(ASSESSMENT_MISSION_BANKS)]) {
      expect(validateMissionBank(bank)).toEqual([]);
    }
  });

  it("rejects changed route topology, zero/cardinal complexity, and objective coverage", () => {
    const reference = ASSESSMENT_MISSION_BANKS.A1[0] as ObservationMission;
    const topologyMismatch: ObservationMission = {
      ...reference,
      variantId: "A1-TOPOLOGY-MISMATCH",
      route: { ...reference.route, moves: [{ direction: "EAST", units: 3 }] },
    };
    const zeroMismatch: ObservationMission = {
      ...reference,
      variantId: "A1-ZERO-MISMATCH",
      route: { ...reference.route, moves: [{ direction: "EAST", units: 3 }, { direction: "WEST", units: 3 }] },
    };
    const objectiveMismatch: ObservationMission = {
      ...reference,
      variantId: "A1-OBJECTIVE-MISMATCH",
      learningObjectives: ["LO1_DISTANCE"],
    };

    expect(validateMissionBank([reference, topologyMismatch])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/move count.*topology/i) })]),
    );
    expect(validateMissionBank([reference, zeroMismatch])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/zero-versus-cardinal/i) })]),
    );
    expect(validateMissionBank([reference, objectiveMismatch])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/same learning objectives/i) })]),
    );
  });

  it("rejects a different planning constraint class", () => {
    const reference = ASSESSMENT_MISSION_BANKS.A4[0] as PlanningMission;
    const mismatch: PlanningMission = {
      ...reference,
      variantId: "A4-CONSTRAINT-MISMATCH",
      board: { ...reference.board, checkpoints: [], obstacles: [{ x: 2, y: 2 }] },
    };
    expect(validateMissionBank([reference, mismatch])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/constraint class/i) })]),
    );
  });

  it("rejects changed concept option count or distractor coverage", () => {
    const reference = ASSESSMENT_MISSION_BANKS.C1[0];
    if (reference.kind !== "CONCEPT_PROBE") throw new Error("Expected concept mission.");
    const fewerOptions = { ...reference, variantId: "C1-OPTION-MISMATCH", options: reference.options.slice(0, 2) };
    const changedDistractor = {
      ...reference,
      variantId: "C1-DISTRACTOR-MISMATCH",
      options: reference.options.map((option) => option.id === "A" ? { id: option.id, label: option.label } : option),
    };
    expect(validateMissionBank([reference, fewerOptions])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/same number of options/i) })]),
    );
    expect(validateMissionBank([reference, changedDistractor])).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/same distractor misconceptions/i) })]),
    );
  });
});
