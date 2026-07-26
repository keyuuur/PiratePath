import { describe, expect, it } from "vitest";
import { PRACTICE_MISSION_BANKS } from "../../src/content";
import { diagnoseMeasurementMisconceptions, type MeasurementResponse, type ObservationMission } from "../../src/domain";

function responseFor(mission: ObservationMission, displacementMagnitude: number): MeasurementResponse {
  return {
    missionId: mission.id,
    variantId: mission.variantId,
    kind: "MEASUREMENT",
    distance: null,
    displacementMagnitude,
    displacementDirection: "NONE",
  };
}

describe("measurement misconception diagnosis", () => {
  it("uses the final y-coordinate for a northbound endpoint", () => {
    const mission = PRACTICE_MISSION_BANKS.P2[0] as ObservationMission;
    expect(diagnoseMeasurementMisconceptions(mission, responseFor(mission, 5))).toContain(
      "FINAL_COORDINATE_AS_DISPLACEMENT",
    );
    expect(diagnoseMeasurementMisconceptions(mission, responseFor(mission, 3))).not.toContain(
      "FINAL_COORDINATE_AS_DISPLACEMENT",
    );
  });

  it("uses the final y-coordinate for a southbound endpoint", () => {
    const mission = PRACTICE_MISSION_BANKS.P2[1] as ObservationMission;
    expect(diagnoseMeasurementMisconceptions(mission, responseFor(mission, 2))).toContain(
      "FINAL_COORDINATE_AS_DISPLACEMENT",
    );
    expect(diagnoseMeasurementMisconceptions(mission, responseFor(mission, 4))).not.toContain(
      "FINAL_COORDINATE_AS_DISPLACEMENT",
    );
  });
});
