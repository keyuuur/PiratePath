import { describe, expect, it } from "vitest";
import {
  analyzeRoute,
  assertCardinalOrZeroDisplacement,
  expandRoute,
  getDisplacementDirection,
} from "../../src/domain";

describe("motion math", () => {
  it("adds every segment for distance while using endpoints for displacement", () => {
    const analysis = analyzeRoute({
      start: { x: 2, y: 1 },
      moves: [
        { direction: "EAST", units: 5 },
        { direction: "WEST", units: 2 },
      ],
    });

    expect(analysis.distance).toBe(7);
    expect(analysis.end).toEqual({ x: 5, y: 1 });
    expect(analysis.displacement).toMatchObject({ dx: 3, dy: 0, magnitude: 3, direction: "EAST" });
  });

  it("reports zero displacement with NONE direction after a round trip", () => {
    const analysis = analyzeRoute({
      start: { x: 4, y: 2 },
      moves: [
        { direction: "WEST", units: 3 },
        { direction: "EAST", units: 3 },
      ],
    });
    expect(analysis.distance).toBe(6);
    expect(analysis.displacement).toMatchObject({ magnitude: 0, direction: "NONE" });
  });

  it("uses Euclidean displacement even though V2 assessment content is cardinal", () => {
    const analysis = analyzeRoute({
      start: { x: 0, y: 0 },
      moves: [
        { direction: "EAST", units: 3 },
        { direction: "NORTH", units: 4 },
      ],
    });
    expect(analysis.distance).toBe(7);
    expect(analysis.displacement.magnitude).toBe(5);
    expect(analysis.displacement.direction).toBe("DIAGONAL");
    expect(() => assertCardinalOrZeroDisplacement(analysis.route)).toThrow(/cardinal or zero/i);
  });

  it("expands each grid step for collision and checkpoint validation", () => {
    expect(expandRoute({ start: { x: 0, y: 0 }, moves: [{ direction: "NORTH", units: 2 }] })).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
  });

  it("rejects non-integer and non-positive movement", () => {
    expect(() => analyzeRoute({ start: { x: 0, y: 0 }, moves: [{ direction: "EAST", units: 1.5 }] })).toThrow(/positive integer/i);
    expect(() => analyzeRoute({ start: { x: 0, y: 0 }, moves: [{ direction: "EAST", units: 0 }] })).toThrow(/positive integer/i);
  });

  it("maps cardinal and zero vectors consistently", () => {
    expect(getDisplacementDirection(2, 0)).toBe("EAST");
    expect(getDisplacementDirection(-2, 0)).toBe("WEST");
    expect(getDisplacementDirection(0, 2)).toBe("NORTH");
    expect(getDisplacementDirection(0, -2)).toBe("SOUTH");
    expect(getDisplacementDirection(0, 0)).toBe("NONE");
  });
});
