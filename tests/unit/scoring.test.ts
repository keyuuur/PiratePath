import { describe, expect, it } from "vitest";
import { ASSESSMENT_MISSION_BANKS, buildAssessmentVariantManifest } from "../../src/content";
import {
  analyzeRoute,
  applyMasteryGates,
  getRawMasteryTier,
  scoreAssessment,
  type AssessmentMission,
  type ConceptMission,
  type MissionResponse,
  type ObservationMission,
  type PlanningMission,
} from "../../src/domain";

function perfectResponse(mission: AssessmentMission): MissionResponse {
  if (mission.kind === "CONCEPT_PROBE") {
    return {
      missionId: mission.id,
      variantId: mission.variantId,
      kind: "CONCEPT",
      selectedOptionId: mission.correctOptionId,
    };
  }
  const route = mission.kind === "PLAN_ROUTE" ? mission.exampleSolution : mission.route;
  const analysis = analyzeRoute(route);
  const base = {
    missionId: mission.id,
    variantId: mission.variantId,
    distance: analysis.distance,
    displacementMagnitude: analysis.displacement.magnitude,
    displacementDirection: analysis.displacement.direction === "DIAGONAL" ? null : analysis.displacement.direction,
  };
  return mission.kind === "PLAN_ROUTE"
    ? { ...base, kind: "PLANNING", route }
    : { ...base, kind: "MEASUREMENT" };
}

describe("assessment scoring", () => {
  it("scores a perfect manifest at 20 points and recommends ClassPoints equal to Tier 5", () => {
    const manifest = buildAssessmentVariantManifest("perfect");
    const result = scoreAssessment(manifest.missions.map(perfectResponse), manifest);
    expect(result).toMatchObject({
      score: 20,
      max: 20,
      directionScore: 5,
      directionMax: 5,
      c3Correct: true,
      rawTier: 5,
      masteryTier: 5,
      capReason: null,
      classPointsCue: 5,
    });
    expect(result.itemResults).toHaveLength(8);
    expect(result.misconceptions).toEqual([]);
  });

  it("awards planning prediction points against the student's actual route", () => {
    const manifest = buildAssessmentVariantManifest("planning-partial");
    const mission = manifest.missions.find((item) => item.id === "A4") as PlanningMission & AssessmentMission;
    const directRoute = {
      start: mission.board.start,
      moves: [{ direction: mission.board.goal.x > mission.board.start.x ? "EAST" as const : "WEST" as const, units: 5 }],
    };
    const analysis = analyzeRoute(directRoute);
    const result = scoreAssessment([
      {
        missionId: mission.id,
        variantId: mission.variantId,
        kind: "PLANNING",
        route: directRoute,
        distance: analysis.distance,
        displacementMagnitude: analysis.displacement.magnitude,
        displacementDirection: analysis.displacement.direction === "DIAGONAL" ? null : analysis.displacement.direction,
      },
    ], manifest);
    const a4 = result.itemResults.find((item) => item.missionId === "A4");
    expect(a4?.earned).toBe(3);
    expect(a4?.components.find((item) => item.id === "ROUTE_CONSTRAINT")?.correct).toBe(false);
  });

  it("ignores a response whose variant does not match the manifest", () => {
    const manifest = buildAssessmentVariantManifest("variant-lock");
    const mission = manifest.missions[0] as ObservationMission & AssessmentMission;
    const response = perfectResponse(mission);
    const result = scoreAssessment([{ ...response, variantId: "WRONG-VARIANT" }], manifest);
    expect(result.itemResults[0]?.earned).toBe(0);
  });

  it("caps any raw Tier 5 core-gate failure directly at Tier 3", () => {
    expect(applyMasteryGates(19, 3, true)).toMatchObject({ rawTier: 5, tier: 3, capReason: "DIRECTION_GATE", classPointsCue: 3 });
    expect(applyMasteryGates(19, 5, false)).toMatchObject({ rawTier: 5, tier: 3, capReason: "C3_GATE", classPointsCue: 3 });
    expect(applyMasteryGates(19, 2, false)).toMatchObject({ rawTier: 5, tier: 3, capReason: "DIRECTION_AND_C3_GATES", classPointsCue: 3 });
  });

  it("caps raw Tier 4 at Tier 3 when the direction gate is missed", () => {
    expect(applyMasteryGates(17, 2, true)).toMatchObject({ rawTier: 4, tier: 3, capReason: "DIRECTION_GATE", classPointsCue: 3 });
    expect(applyMasteryGates(17, 3, false)).toMatchObject({ rawTier: 4, tier: 4, capReason: null, classPointsCue: 4 });
  });

  it("preserves every raw score threshold from 0 through 20", () => {
    const expectedTiers = [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      2, 2, 2, 2,
      3, 3,
      4, 4,
      5, 5, 5,
    ] as const;

    expectedTiers.forEach((expectedTier, score) => {
      expect(getRawMasteryTier(score), `score ${score}`).toBe(expectedTier);
    });
  });

  it("applies the mastery gates and tier-equal ClassPoints cue for every score, direction score, and C3 state", () => {
    for (let score = 0; score <= 20; score += 1) {
      for (let directionScore = 0; directionScore <= 5; directionScore += 1) {
        for (const c3Correct of [false, true]) {
          const rawTier = getRawMasteryTier(score);
          let tier = rawTier;
          let capReason: ReturnType<typeof applyMasteryGates>["capReason"] = null;

          if (rawTier === 5 && (directionScore < 4 || !c3Correct)) {
            const missesDirectionGate = directionScore < 4;
            const missesC3Gate = !c3Correct;
            tier = 3;
            capReason = missesDirectionGate && missesC3Gate
              ? "DIRECTION_AND_C3_GATES"
              : missesDirectionGate
                ? "DIRECTION_GATE"
                : "C3_GATE";
          } else if (rawTier === 4 && directionScore < 3) {
            tier = 3;
            capReason = "DIRECTION_GATE";
          }

          expect(
            applyMasteryGates(score, directionScore, c3Correct),
            `score=${score}, direction=${directionScore}, c3=${c3Correct}`,
          ).toMatchObject({
            rawTier,
            tier,
            capReason,
            classPointsCue: tier,
            coreGateApplied: tier !== rawTier,
          });
        }
      }
    }
  });

  it("counts all five assessment directions, including A2's zero-vector NONE response", () => {
    const manifest = buildAssessmentVariantManifest("direction-contract");
    const responses = manifest.missions.map(perfectResponse);
    const a2 = manifest.missions.find((mission) => mission.id === "A2") as ObservationMission & AssessmentMission;
    const a2Analysis = analyzeRoute(a2.route);
    const result = scoreAssessment(responses, manifest);
    const directionComponents = result.itemResults.flatMap((item) =>
      item.components.filter((component) => component.id === "DISPLACEMENT_DIRECTION"),
    );

    expect(a2Analysis.displacement).toMatchObject({ magnitude: 0, direction: "NONE" });
    expect(directionComponents).toHaveLength(5);
    expect(result.itemResults.find((item) => item.missionId === "A2")?.components).toContainEqual(
      expect.objectContaining({ id: "DISPLACEMENT_DIRECTION", earned: 1, possible: 1, correct: true }),
    );
    expect(result).toMatchObject({ directionScore: 5, directionMax: 5 });
  });

  it("keeps every C3 variant as the zero-displacement concept probe", () => {
    for (const mission of ASSESSMENT_MISSION_BANKS.C3) {
      expect(mission).toMatchObject({ id: "C3", kind: "CONCEPT_PROBE", pointValue: 1 });
      expect(mission.learningObjectives).toContain("LO3_ZERO_DISPLACEMENT");
      const correctOption = mission.options.find((option) => option.id === mission.correctOptionId);
      expect(`${correctOption?.label} ${mission.explanation}`).toMatch(/0 m|zero|start/i);
    }
  });

  it("diagnoses item-level misconceptions", () => {
    const manifest = buildAssessmentVariantManifest("misconceptions");
    const a1 = manifest.missions.find((mission) => mission.id === "A1") as ObservationMission & AssessmentMission;
    const c2 = manifest.missions.find((mission) => mission.id === "C2") as ConceptMission & AssessmentMission;
    const expected = analyzeRoute(a1.route);
    const badConcept = c2.options.find((option) => option.misconceptionCode === "SAME_ENDPOINTS_MEAN_SAME_DISTANCE");
    const result = scoreAssessment([
      {
        missionId: a1.id,
        variantId: a1.variantId,
        kind: "MEASUREMENT",
        distance: expected.displacement.magnitude,
        displacementMagnitude: expected.distance,
        displacementDirection: null,
      },
      {
        missionId: c2.id,
        variantId: c2.variantId,
        kind: "CONCEPT",
        selectedOptionId: badConcept?.id ?? null,
      },
    ], manifest);
    expect(result.misconceptions).toEqual(expect.arrayContaining([
      "STRAIGHT_LINE_AS_DISTANCE",
      "PATH_AS_DISPLACEMENT",
      "DIRECTION_OMITTED",
      "SAME_ENDPOINTS_MEAN_SAME_DISTANCE",
    ]));
  });
});
