import { analyzeRoute } from "./motion";
import { diagnoseConceptMisconception, diagnoseMeasurementMisconceptions } from "./misconceptions";
import type {
  AssessmentMission,
  AssessmentScore,
  AssessmentVariantManifest,
  ConceptMission,
  ConceptResponse,
  MasteryResult,
  MasteryTier,
  MeasurementResponse,
  MissionResponse,
  MissionScore,
  MisconceptionCode,
  ObservationMission,
  PlanningMission,
  PlanningResponse,
  ScoreComponent,
  ScoreComponentId,
} from "./types";
import { assertValidAssessmentForm, evaluateRouteConstraints } from "./validation";

const EPSILON = 1e-9;

function numbersMatch(left: number | null, right: number): boolean {
  return left !== null && Number.isFinite(left) && Math.abs(left - right) < EPSILON;
}

function component(id: ScoreComponentId, correct: boolean): ScoreComponent {
  return { id, earned: correct ? 1 : 0, possible: 1, correct };
}

function emptyScore(mission: AssessmentMission): MissionScore {
  const componentIds: readonly ScoreComponentId[] =
    mission.kind === "CONCEPT_PROBE"
      ? ["CONCEPT"]
      : mission.kind === "PLAN_ROUTE"
        ? ["ROUTE_CONSTRAINT", "DISTANCE", "DISPLACEMENT_MAGNITUDE", "DISPLACEMENT_DIRECTION"]
        : ["DISTANCE", "DISPLACEMENT_MAGNITUDE", "DISPLACEMENT_DIRECTION"];
  return {
    missionId: mission.id,
    variantId: mission.variantId,
    earned: 0,
    possible: mission.pointValue,
    components: componentIds.map((id) => component(id, false)),
    misconceptions: [],
  };
}

function finalizeMissionScore(
  mission: AssessmentMission,
  components: readonly ScoreComponent[],
  misconceptions: readonly MisconceptionCode[],
): MissionScore {
  return {
    missionId: mission.id,
    variantId: mission.variantId,
    earned: components.reduce((sum, item) => sum + item.earned, 0),
    possible: mission.pointValue,
    components,
    misconceptions: [...new Set(misconceptions)],
  };
}

function scoreObservation(mission: ObservationMission & AssessmentMission, response: MeasurementResponse): MissionScore {
  const expected = analyzeRoute(mission.route);
  const components = [
    component("DISTANCE", numbersMatch(response.distance, expected.distance)),
    component("DISPLACEMENT_MAGNITUDE", numbersMatch(response.displacementMagnitude, expected.displacement.magnitude)),
    component(
      "DISPLACEMENT_DIRECTION",
      expected.displacement.direction !== "DIAGONAL" && response.displacementDirection === expected.displacement.direction,
    ),
  ];
  return finalizeMissionScore(mission, components, diagnoseMeasurementMisconceptions(mission, response));
}

function scorePlanning(mission: PlanningMission & AssessmentMission, response: PlanningResponse): MissionScore {
  const actual = analyzeRoute(response.route);
  const constraintResult = evaluateRouteConstraints(response.route, mission.board);
  const components = [
    component("ROUTE_CONSTRAINT", constraintResult.valid),
    component("DISTANCE", numbersMatch(response.distance, actual.distance)),
    component("DISPLACEMENT_MAGNITUDE", numbersMatch(response.displacementMagnitude, actual.displacement.magnitude)),
    component(
      "DISPLACEMENT_DIRECTION",
      actual.displacement.direction !== "DIAGONAL" && response.displacementDirection === actual.displacement.direction,
    ),
  ];
  return finalizeMissionScore(mission, components, diagnoseMeasurementMisconceptions(mission, response));
}

function scoreConcept(mission: ConceptMission & AssessmentMission, response: ConceptResponse): MissionScore {
  const correct = response.selectedOptionId === mission.correctOptionId;
  return finalizeMissionScore(
    mission,
    [component("CONCEPT", correct)],
    diagnoseConceptMisconception(mission, response),
  );
}

export function scoreMission(
  mission: AssessmentMission,
  response: MissionResponse | undefined,
): MissionScore {
  if (!response || response.variantId !== mission.variantId || response.missionId !== mission.id) {
    return emptyScore(mission);
  }
  if (mission.kind === "OBSERVE_ROUTE" && response.kind === "MEASUREMENT") {
    return scoreObservation(mission, response);
  }
  if (mission.kind === "PLAN_ROUTE" && response.kind === "PLANNING") {
    return scorePlanning(mission, response);
  }
  if (mission.kind === "CONCEPT_PROBE" && response.kind === "CONCEPT") {
    return scoreConcept(mission, response);
  }
  return emptyScore(mission);
}

export function getRawMasteryTier(score: number): MasteryTier {
  if (score >= 18) return 5;
  if (score >= 16) return 4;
  if (score >= 14) return 3;
  if (score >= 10) return 2;
  return 1;
}

export function applyMasteryGates(
  score: number,
  directionScore: number,
  c3Correct: boolean,
): MasteryResult & { readonly rawTier: MasteryTier; readonly capReason: AssessmentScore["capReason"] } {
  const rawTier = getRawMasteryTier(score);
  let tier = rawTier;
  let capReason: AssessmentScore["capReason"] = null;

  if (rawTier === 5 && (directionScore < 4 || !c3Correct)) {
    const missesDirectionGate = directionScore < 4;
    const missesC3Gate = !c3Correct;
    capReason = missesDirectionGate && missesC3Gate
      ? "DIRECTION_AND_C3_GATES"
      : missesDirectionGate
        ? "DIRECTION_GATE"
        : "C3_GATE";
    tier = 3;
  } else if (rawTier === 4 && directionScore < 3) {
    tier = 3;
    capReason = "DIRECTION_GATE";
  }

  const labels: Record<MasteryTier, MasteryResult["label"]> = {
    1: "Beginning",
    2: "Developing",
    3: "Approaching",
    4: "Proficient",
    5: "Mastered",
  };
  return {
    rawTier,
    tier,
    label: labels[tier],
    classPointsCue: tier,
    coreGateApplied: tier !== rawTier,
    capReason,
  };
}

export function scoreAssessment(
  responses: readonly MissionResponse[],
  variantManifest: AssessmentVariantManifest,
): AssessmentScore {
  assertValidAssessmentForm(variantManifest.missions);
  const responseByMission = new Map(responses.map((response) => [response.missionId, response]));
  const itemResults = variantManifest.missions.map((mission) => scoreMission(mission, responseByMission.get(mission.id)));
  const score = itemResults.reduce((sum, result) => sum + result.earned, 0);
  const directionScore = itemResults.reduce(
    (sum, result) => sum + (result.components.find((item) => item.id === "DISPLACEMENT_DIRECTION")?.earned ?? 0),
    0,
  );
  const c3Correct = itemResults.find((result) => result.missionId === "C3")?.earned === 1;
  const mastery = applyMasteryGates(score, directionScore, c3Correct);

  return {
    score,
    max: 20,
    percent: Number(((score / 20) * 100).toFixed(2)),
    directionScore,
    directionMax: 5,
    c3Correct,
    rawTier: mastery.rawTier,
    masteryTier: mastery.tier,
    capReason: mastery.capReason,
    classPointsCue: mastery.classPointsCue,
    itemResults,
    misconceptions: [...new Set(itemResults.flatMap((result) => result.misconceptions))],
  };
}
