import { analyzeRoute, oppositeDirection } from "./motion";
import type {
  ConceptMission,
  ConceptResponse,
  MeasurementResponse,
  MisconceptionCode,
  ObservationMission,
  PlanningMission,
  PlanningResponse,
} from "./types";

function unique(codes: readonly MisconceptionCode[]): readonly MisconceptionCode[] {
  return [...new Set(codes)];
}

export function diagnoseMeasurementMisconceptions(
  mission: ObservationMission | PlanningMission,
  response: MeasurementResponse | PlanningResponse,
): readonly MisconceptionCode[] {
  const route = response.kind === "PLANNING" ? response.route : mission.kind === "OBSERVE_ROUTE" ? mission.route : mission.exampleSolution;
  const analysis = analyzeRoute(route);
  const codes: MisconceptionCode[] = [];

  if (
    response.distance !== null &&
    response.distance !== analysis.distance &&
    response.distance === analysis.displacement.magnitude
  ) {
    codes.push("STRAIGHT_LINE_AS_DISTANCE");
  }

  if (
    response.displacementMagnitude !== null &&
    response.displacementMagnitude !== analysis.displacement.magnitude &&
    response.displacementMagnitude === analysis.distance
  ) {
    codes.push("PATH_AS_DISPLACEMENT");
  }

  const signedNet = analysis.displacement.dx + analysis.displacement.dy;
  if (
    response.distance !== null &&
    response.distance !== analysis.distance &&
    response.distance === Math.abs(signedNet) &&
    analysis.distance > analysis.displacement.magnitude
  ) {
    codes.push("RETURN_SEGMENTS_CANCEL_DISTANCE");
  }

  const finalCoordinate = analysis.displacement.direction === "NORTH" || analysis.displacement.direction === "SOUTH"
    ? Math.abs(analysis.end.y)
    : analysis.displacement.direction === "EAST" || analysis.displacement.direction === "WEST"
      ? Math.abs(analysis.end.x)
      : null;
  if (
    finalCoordinate !== null &&
    response.displacementMagnitude !== null &&
    response.displacementMagnitude !== analysis.displacement.magnitude &&
    response.displacementMagnitude === finalCoordinate
  ) {
    codes.push("FINAL_COORDINATE_AS_DISPLACEMENT");
  }

  if (response.displacementDirection === null) {
    codes.push("DIRECTION_OMITTED");
  } else if (
    analysis.displacement.direction !== "DIAGONAL" &&
    analysis.displacement.direction !== "NONE" &&
    response.displacementDirection === oppositeDirection(analysis.displacement.direction)
  ) {
    codes.push("DIRECTION_REVERSED");
  }

  if (
    analysis.displacement.direction === "NONE" &&
    response.displacementDirection !== null &&
    response.displacementDirection !== "NONE"
  ) {
    codes.push("ZERO_VECTOR_HAS_DIRECTION");
  }

  return unique(codes);
}

export function diagnoseConceptMisconception(
  mission: ConceptMission,
  response: ConceptResponse,
): readonly MisconceptionCode[] {
  if (response.selectedOptionId === mission.correctOptionId || response.selectedOptionId === null) {
    return [];
  }
  const selected = mission.options.find((option) => option.id === response.selectedOptionId);
  return selected?.misconceptionCode ? [selected.misconceptionCode] : [];
}
