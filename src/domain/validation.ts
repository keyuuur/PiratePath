import { analyzeRoute, assertCardinalOrZeroDisplacement, samePoint } from "./motion";
import type {
  AssessmentMission,
  BoardDefinition,
  Mission,
  MoveDirection,
  PlanningMission,
  Point,
  Route,
  RouteConstraintResult,
  ValidationIssue,
} from "./types";

function sameSet<T extends string>(left: readonly T[], right: readonly T[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function directionRelationship(left: MoveDirection, right: MoveDirection): "SAME" | "OPPOSITE" | "PERPENDICULAR" {
  if (left === right) return "SAME";
  const horizontal = (direction: MoveDirection) => direction === "EAST" || direction === "WEST";
  if (horizontal(left) !== horizontal(right)) return "PERPENDICULAR";
  return "OPPOSITE";
}

/**
 * Describes the cognitive shape of a route without requiring identical numbers
 * or absolute compass orientation. Reflections and rotations therefore remain
 * equivalent, while added turns or changed backtracking do not.
 */
function routeTopology(route: Route): string {
  const relationships: string[] = [];
  route.moves.forEach((move, index) => {
    for (let otherIndex = index + 1; otherIndex < route.moves.length; otherIndex += 1) {
      const other = route.moves[otherIndex];
      if (other) relationships.push(`${index}-${otherIndex}:${directionRelationship(move.direction, other.direction)}`);
    }
  });
  return `${route.moves.length}|${relationships.join("|")}`;
}

function responseComplexity(route: Route): "ZERO" | "CARDINAL" | "DIAGONAL" {
  const direction = analyzeRoute(route).displacement.direction;
  if (direction === "NONE") return "ZERO";
  return direction === "DIAGONAL" ? "DIAGONAL" : "CARDINAL";
}

function planningConstraintClass(board: BoardDefinition): string {
  return `CHECKPOINT:${board.checkpoints.length}|OBSTACLE:${board.obstacles.length}`;
}

function conceptDistractorCoverage(mission: Extract<Mission, { kind: "CONCEPT_PROBE" }>): readonly string[] {
  return mission.options
    .flatMap((option) => option.misconceptionCode ? [option.misconceptionCode] : [])
    .sort();
}

export function pointInBounds(point: Point, board: BoardDefinition): boolean {
  return point.x >= 0 && point.x < board.width && point.y >= 0 && point.y < board.height;
}

export function evaluateRouteConstraints(route: Route, board: BoardDefinition): RouteConstraintResult {
  const issues: string[] = [];
  let analysis;
  try {
    analysis = analyzeRoute(route);
  } catch (error) {
    return {
      valid: false,
      reachesGoal: false,
      checkpointsVisitedInOrder: false,
      avoidsObstacles: false,
      staysInBounds: false,
      withinCommandLimit: route.moves.length <= board.maxCommands,
      issues: [error instanceof Error ? error.message : "Invalid route."],
    };
  }

  const startsCorrectly = samePoint(route.start, board.start);
  if (!startsCorrectly) issues.push("Route does not start at the board start.");

  const staysInBounds = analysis.visitedPoints.every((point) => pointInBounds(point, board));
  if (!staysInBounds) issues.push("Route leaves the board.");

  const avoidsObstacles = analysis.visitedPoints.every(
    (point) => !board.obstacles.some((obstacle) => samePoint(point, obstacle)),
  );
  if (!avoidsObstacles) issues.push("Route crosses an obstacle.");

  let searchFrom = 0;
  let checkpointsVisitedInOrder = true;
  for (const checkpoint of board.checkpoints) {
    const foundAt = analysis.visitedPoints.findIndex(
      (point, index) => index >= searchFrom && samePoint(point, checkpoint),
    );
    if (foundAt < 0) {
      checkpointsVisitedInOrder = false;
      break;
    }
    searchFrom = foundAt + 1;
  }
  if (!checkpointsVisitedInOrder) issues.push("Route misses a checkpoint or visits checkpoints out of order.");

  const reachesGoal = samePoint(analysis.end, board.goal);
  if (!reachesGoal) issues.push("Route does not finish at the goal.");

  const withinCommandLimit = route.moves.length <= board.maxCommands;
  if (!withinCommandLimit) issues.push("Route uses too many commands.");

  return {
    valid: startsCorrectly && staysInBounds && avoidsObstacles && checkpointsVisitedInOrder && reachesGoal && withinCommandLimit,
    reachesGoal,
    checkpointsVisitedInOrder,
    avoidsObstacles,
    staysInBounds,
    withinCommandLimit,
    issues,
  };
}

function validateBoard(board: BoardDefinition, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(board.width) || !Number.isInteger(board.height) || board.width <= 1 || board.height <= 1) {
    issues.push({ path, message: "Board width and height must be integers greater than one." });
  }
  if (!Number.isInteger(board.maxCommands) || board.maxCommands <= 0) {
    issues.push({ path: `${path}.maxCommands`, message: "Command limit must be a positive integer." });
  }
  for (const [label, points] of [
    ["start", [board.start]],
    ["goal", [board.goal]],
    ["checkpoints", board.checkpoints],
    ["obstacles", board.obstacles],
  ] as const) {
    points.forEach((point, index) => {
      if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !pointInBounds(point, board)) {
        issues.push({ path: `${path}.${label}[${index}]`, message: "Point must be an in-bounds integer coordinate." });
      }
    });
  }
  if (board.obstacles.some((point) => samePoint(point, board.start) || samePoint(point, board.goal))) {
    issues.push({ path: `${path}.obstacles`, message: "Obstacles cannot cover the start or goal." });
  }
  return issues;
}

export function validateMission(mission: Mission): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!mission.variantId.trim()) issues.push({ path: "variantId", message: "Variant ID is required." });
  if (mission.phase === "PRACTICE" && mission.pointValue !== 0) {
    issues.push({ path: "pointValue", message: "Practice missions must be unscored." });
  }
  if (mission.phase === "ASSESSMENT" && mission.pointValue <= 0) {
    issues.push({ path: "pointValue", message: "Assessment missions must award points." });
  }

  if (mission.kind === "OBSERVE_ROUTE") {
    try {
      const analysis = assertCardinalOrZeroDisplacement(mission.route);
      if (!Number.isInteger(analysis.distance) || !Number.isInteger(analysis.displacement.magnitude)) {
        issues.push({ path: "route", message: "V2 missions must produce integer measurements." });
      }
    } catch (error) {
      issues.push({ path: "route", message: error instanceof Error ? error.message : "Invalid route." });
    }
  }

  if (mission.kind === "PLAN_ROUTE") {
    issues.push(...validateBoard(mission.board, "board"));
    try {
      const analysis = assertCardinalOrZeroDisplacement(mission.exampleSolution);
      if (!Number.isInteger(analysis.distance) || !Number.isInteger(analysis.displacement.magnitude)) {
        issues.push({ path: "exampleSolution", message: "V2 missions must produce integer measurements." });
      }
      const result = evaluateRouteConstraints(mission.exampleSolution, mission.board);
      if (!result.valid) {
        issues.push({ path: "exampleSolution", message: `Authoring solution is invalid: ${result.issues.join(" ")}` });
      }
    } catch (error) {
      issues.push({ path: "exampleSolution", message: error instanceof Error ? error.message : "Invalid route." });
    }
  }

  if (mission.kind === "CONCEPT_PROBE") {
    const optionIds = mission.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      issues.push({ path: "options", message: "Concept option IDs must be unique." });
    }
    if (!optionIds.includes(mission.correctOptionId)) {
      issues.push({ path: "correctOptionId", message: "Correct option must exist in the option list." });
    }
  }
  return issues;
}

export function validateMissionBank(bank: readonly Mission[]): readonly ValidationIssue[] {
  if (bank.length === 0) return [{ path: "bank", message: "Mission bank cannot be empty." }];
  const issues: ValidationIssue[] = [];
  const reference = bank[0];
  if (reference === undefined) return issues;
  bank.forEach((mission, index) => {
    validateMission(mission).forEach((issue) => issues.push({ path: `[${index}].${issue.path}`, message: issue.message }));
    if (mission.id !== reference.id || mission.kind !== reference.kind || mission.pointValue !== reference.pointValue) {
      issues.push({ path: `[${index}]`, message: "Equivalent variants must share mission ID, kind, and point value." });
    }
    if (!sameSet(mission.learningObjectives, reference.learningObjectives)) {
      issues.push({ path: `[${index}].learningObjectives`, message: "Equivalent variants must cover the same learning objectives." });
    }
    if (!sameSet(mission.misconceptionTargets, reference.misconceptionTargets)) {
      issues.push({ path: `[${index}].misconceptionTargets`, message: "Equivalent variants must target the same misconceptions." });
    }

    if (mission.kind === "OBSERVE_ROUTE" && reference.kind === "OBSERVE_ROUTE") {
      if (routeTopology(mission.route) !== routeTopology(reference.route)) {
        issues.push({ path: `[${index}].route`, message: "Equivalent route variants must share move count and turn/backtracking topology." });
      }
      if (responseComplexity(mission.route) !== responseComplexity(reference.route)) {
        issues.push({ path: `[${index}].route`, message: "Equivalent route variants must share zero-versus-cardinal response complexity." });
      }
    }

    if (mission.kind === "PLAN_ROUTE" && reference.kind === "PLAN_ROUTE") {
      if (planningConstraintClass(mission.board) !== planningConstraintClass(reference.board)) {
        issues.push({ path: `[${index}].board`, message: "Equivalent planning variants must share checkpoint and obstacle constraint class." });
      }
      if (mission.board.maxCommands !== reference.board.maxCommands) {
        issues.push({ path: `[${index}].board.maxCommands`, message: "Equivalent planning variants must share the command limit." });
      }
      if (routeTopology(mission.exampleSolution) !== routeTopology(reference.exampleSolution)) {
        issues.push({ path: `[${index}].exampleSolution`, message: "Equivalent planning variants must share solution move count and topology." });
      }
      if (responseComplexity(mission.exampleSolution) !== responseComplexity(reference.exampleSolution)) {
        issues.push({ path: `[${index}].exampleSolution`, message: "Equivalent planning variants must share zero-versus-cardinal response complexity." });
      }
    }

    if (mission.kind === "CONCEPT_PROBE" && reference.kind === "CONCEPT_PROBE") {
      if (mission.options.length !== reference.options.length) {
        issues.push({ path: `[${index}].options`, message: "Equivalent concept variants must offer the same number of options." });
      }
      if (!sameSet(conceptDistractorCoverage(mission), conceptDistractorCoverage(reference))) {
        issues.push({ path: `[${index}].options`, message: "Equivalent concept variants must diagnose the same distractor misconceptions." });
      }
    }
  });
  return issues;
}

export function validateAssessmentForm(form: readonly AssessmentMission[]): readonly ValidationIssue[] {
  const expectedIds = ["A1", "A2", "A3", "A4", "A5", "C1", "C2", "C3"];
  const issues: ValidationIssue[] = [];
  const ids = form.map((mission) => mission.id);
  if (ids.join("|") !== expectedIds.join("|")) {
    issues.push({ path: "form", message: "Assessment form must contain A1-A5 followed by C1-C3 exactly once." });
  }
  const total = form.reduce((sum, mission) => sum + mission.pointValue, 0);
  if (total !== 20) issues.push({ path: "form", message: `Assessment must total 20 points; received ${total}.` });
  form.forEach((mission, index) => {
    validateMission(mission).forEach((issue) => issues.push({ path: `[${index}].${issue.path}`, message: issue.message }));
  });
  return issues;
}

export function assertValidMissionBank(bank: readonly Mission[]): void {
  const issues = validateMissionBank(bank);
  if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
}

export function assertValidAssessmentForm(form: readonly AssessmentMission[]): void {
  const issues = validateAssessmentForm(form);
  if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
}

export function isPlanningMission(mission: Mission): mission is PlanningMission {
  return mission.kind === "PLAN_ROUTE";
}
