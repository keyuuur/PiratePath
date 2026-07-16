import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_MISSION_BANKS,
  ASSESSMENT_MISSION_ORDER,
  CONTENT_VERSION,
  PRACTICE_MISSION_BANKS,
  assertValidV2Content,
  buildAssessmentVariantManifest,
  buildPracticeSequence,
} from "../../src/content";
import { analyzeRoute, selectDeterministicVariant, validateAssessmentForm } from "../../src/domain";

describe("V2 mission content", () => {
  it("exports a stable content version", () => {
    expect(CONTENT_VERSION).toBe("pirate-path-v2-2026-07-15");
  });

  it("validates every practice and assessment variant", () => {
    expect(() => assertValidV2Content()).not.toThrow();
  });

  it("builds the locked eight-item, 20-point assessment blueprint", () => {
    const manifest = buildAssessmentVariantManifest("student-a|period-2|session-7");
    expect(manifest.missions.map((mission) => mission.id)).toEqual(ASSESSMENT_MISSION_ORDER);
    expect(manifest.missions.reduce((sum, mission) => sum + mission.pointValue, 0)).toBe(20);
    expect(validateAssessmentForm(manifest.missions)).toEqual([]);
  });

  it("selects equivalent variants deterministically", () => {
    const first = buildAssessmentVariantManifest("same-seed");
    const second = buildAssessmentVariantManifest("same-seed");
    expect(second).toEqual(first);
    expect(selectDeterministicVariant("seed", "A1", ASSESSMENT_MISSION_BANKS.A1)).toBe(
      selectDeterministicVariant("seed", "A1", ASSESSMENT_MISSION_BANKS.A1),
    );
  });

  it("keeps concept variants aligned on option count, objectives, and misconception coverage", () => {
    for (const id of ["C1", "C2", "C3"] as const) {
      const [reference, ...variants] = ASSESSMENT_MISSION_BANKS[id];
      if (!reference || reference.kind !== "CONCEPT_PROBE") throw new Error(`Expected ${id} concept variants.`);
      const objectives = [...reference.learningObjectives].sort();
      const distractors = reference.options.flatMap((option) => option.misconceptionCode ? [option.misconceptionCode] : []).sort();
      for (const variant of variants) {
        if (variant.kind !== "CONCEPT_PROBE") throw new Error(`Expected ${id} concept variants.`);
        expect(variant.options).toHaveLength(reference.options.length);
        expect([...variant.learningObjectives].sort()).toEqual(objectives);
        expect(variant.options.flatMap((option) => option.misconceptionCode ? [option.misconceptionCode] : []).sort()).toEqual(distractors);
      }
    }
  });

  it("keeps all V2 measurements integer and all assessment displacement cardinal or zero", () => {
    Object.values(ASSESSMENT_MISSION_BANKS).flat().forEach((mission) => {
      if (mission.kind === "CONCEPT_PROBE") return;
      const route = mission.kind === "OBSERVE_ROUTE" ? mission.route : mission.exampleSolution;
      const analysis = analyzeRoute(route);
      expect(Number.isInteger(analysis.distance)).toBe(true);
      expect(Number.isInteger(analysis.displacement.magnitude)).toBe(true);
      expect(analysis.displacement.direction).not.toBe("DIAGONAL");
    });
  });

  it("uses A4 for checkpoint planning and A5 for obstacle planning", () => {
    for (const mission of ASSESSMENT_MISSION_BANKS.A4) {
      expect(mission.kind).toBe("PLAN_ROUTE");
      if (mission.kind === "PLAN_ROUTE") expect(mission.board.checkpoints.length).toBeGreaterThan(0);
    }
    for (const mission of ASSESSMENT_MISSION_BANKS.A5) {
      expect(mission.kind).toBe("PLAN_ROUTE");
      if (mission.kind === "PLAN_ROUTE") expect(mission.board.obstacles.length).toBeGreaterThan(0);
    }
  });

  it("builds exactly three unscored guided practice missions", () => {
    const practice = buildPracticeSequence("practice-seed");
    expect(practice.map((mission) => mission.id)).toEqual(["P1", "P2", "P3"]);
    expect(practice.every((mission) => mission.phase === "PRACTICE" && mission.pointValue === 0)).toBe(true);
    expect(Object.keys(PRACTICE_MISSION_BANKS)).toEqual(["P1", "P2", "P3"]);
  });
});
