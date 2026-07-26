export * from "./assessment";
export * from "./practice";

export const CONTENT_VERSION = "pirate-path-v2-2026-07-15";

import { assertValidAssessmentContent } from "./assessment";
import { assertValidPracticeContent } from "./practice";

export function assertValidV2Content(): void {
  assertValidPracticeContent();
  assertValidAssessmentContent();
}
