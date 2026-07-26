import type {
  DisplacementDirection,
  MotionAnalysis,
  Move,
  Point,
  Route,
} from "./types";

const EPSILON = 1e-9;

export function isIntegerPoint(point: Point): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y);
}

export function assertValidMove(move: Move): void {
  if (!Number.isInteger(move.units) || move.units <= 0) {
    throw new Error(`Move units must be a positive integer; received ${move.units}.`);
  }
}

export function moveOneUnit(point: Point, direction: Move["direction"]): Point {
  if (direction === "EAST") return { x: point.x + 1, y: point.y };
  if (direction === "WEST") return { x: point.x - 1, y: point.y };
  if (direction === "NORTH") return { x: point.x, y: point.y + 1 };
  return { x: point.x, y: point.y - 1 };
}

export function expandRoute(route: Route): readonly Point[] {
  if (!isIntegerPoint(route.start)) {
    throw new Error("Route start must use integer grid coordinates.");
  }

  const visited: Point[] = [{ ...route.start }];
  let current = route.start;
  for (const move of route.moves) {
    assertValidMove(move);
    for (let step = 0; step < move.units; step += 1) {
      current = moveOneUnit(current, move.direction);
      visited.push(current);
    }
  }
  return visited;
}

export function getDisplacementDirection(dx: number, dy: number): DisplacementDirection | "DIAGONAL" {
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return "NONE";
  if (Math.abs(dx) >= EPSILON && Math.abs(dy) >= EPSILON) return "DIAGONAL";
  if (dx > 0) return "EAST";
  if (dx < 0) return "WEST";
  if (dy > 0) return "NORTH";
  return "SOUTH";
}

export function analyzeRoute(route: Route): MotionAnalysis {
  const visitedPoints = expandRoute(route);
  const end = visitedPoints[visitedPoints.length - 1] ?? route.start;
  const dx = end.x - route.start.x;
  const dy = end.y - route.start.y;

  return {
    route,
    visitedPoints,
    end,
    distance: route.moves.reduce((sum, move) => sum + move.units, 0),
    displacement: {
      dx,
      dy,
      magnitude: Math.hypot(dx, dy),
      direction: getDisplacementDirection(dx, dy),
    },
  };
}

export function assertCardinalOrZeroDisplacement(route: Route): MotionAnalysis {
  const analysis = analyzeRoute(route);
  if (analysis.displacement.direction === "DIAGONAL") {
    throw new Error("V2 assessment routes must have cardinal or zero displacement.");
  }
  return analysis;
}

export function oppositeDirection(direction: DisplacementDirection): DisplacementDirection {
  if (direction === "NORTH") return "SOUTH";
  if (direction === "SOUTH") return "NORTH";
  if (direction === "EAST") return "WEST";
  if (direction === "WEST") return "EAST";
  return "NONE";
}

export function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}
