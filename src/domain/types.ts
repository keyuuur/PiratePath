export type MissionId =
  | "P1"
  | "P2"
  | "P3"
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "C1"
  | "C2"
  | "C3";

export type AssessmentMissionId = Exclude<MissionId, "P1" | "P2" | "P3">;

export type LearningObjectiveId =
  | "LO1_DISTANCE"
  | "LO2_VECTOR"
  | "LO3_ZERO_DISPLACEMENT"
  | "LO4_COMPARE_ROUTES"
  | "LO5_PLAN_ROUTE"
  | "LO6_UNITS";

export type MoveDirection = "NORTH" | "SOUTH" | "EAST" | "WEST";
export type DisplacementDirection = MoveDirection | "NONE";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Move {
  readonly direction: MoveDirection;
  readonly units: number;
}

export interface Route {
  readonly start: Point;
  readonly moves: readonly Move[];
}

export interface DisplacementVector {
  readonly dx: number;
  readonly dy: number;
  readonly magnitude: number;
  readonly direction: DisplacementDirection | "DIAGONAL";
}

export interface MotionAnalysis {
  readonly route: Route;
  readonly visitedPoints: readonly Point[];
  readonly end: Point;
  readonly distance: number;
  readonly displacement: DisplacementVector;
}

export type MisconceptionCode =
  | "PATH_AS_DISPLACEMENT"
  | "STRAIGHT_LINE_AS_DISTANCE"
  | "RETURN_SEGMENTS_CANCEL_DISTANCE"
  | "FINAL_COORDINATE_AS_DISPLACEMENT"
  | "DIRECTION_OMITTED"
  | "DIRECTION_REVERSED"
  | "ZERO_DISPLACEMENT_MEANS_NO_MOTION"
  | "SAME_ENDPOINTS_MEAN_SAME_DISTANCE"
  | "LONGER_PATH_MEANS_LARGER_DISPLACEMENT"
  | "ZERO_VECTOR_HAS_DIRECTION";

export interface MissionBase {
  readonly id: MissionId;
  readonly variantId: string;
  readonly phase: "PRACTICE" | "ASSESSMENT";
  readonly title: string;
  readonly prompt: string;
  readonly pointValue: number;
  readonly learningObjectives: readonly LearningObjectiveId[];
  readonly misconceptionTargets: readonly MisconceptionCode[];
}

export interface ObservationMission extends MissionBase {
  readonly kind: "OBSERVE_ROUTE";
  readonly route: Route;
}

export interface BoardDefinition {
  readonly width: number;
  readonly height: number;
  readonly start: Point;
  readonly goal: Point;
  readonly checkpoints: readonly Point[];
  readonly obstacles: readonly Point[];
  readonly maxCommands: number;
}

export interface PlanningMission extends MissionBase {
  readonly kind: "PLAN_ROUTE";
  readonly board: BoardDefinition;
  /** A verified authoring solution. Student routes do not need to match it. */
  readonly exampleSolution: Route;
}

export interface ConceptOption {
  readonly id: string;
  readonly label: string;
  readonly misconceptionCode?: MisconceptionCode;
}

export interface ConceptMission extends MissionBase {
  readonly kind: "CONCEPT_PROBE";
  readonly options: readonly ConceptOption[];
  readonly correctOptionId: string;
  readonly explanation: string;
}

export type Mission = ObservationMission | PlanningMission | ConceptMission;
export type AssessmentMission = Mission & { readonly id: AssessmentMissionId; readonly phase: "ASSESSMENT" };

export interface MeasurementResponse {
  readonly missionId: MissionId;
  readonly variantId: string;
  readonly kind: "MEASUREMENT";
  readonly distance: number | null;
  readonly displacementMagnitude: number | null;
  readonly displacementDirection: DisplacementDirection | null;
}

export interface PlanningResponse extends Omit<MeasurementResponse, "kind"> {
  readonly kind: "PLANNING";
  readonly route: Route;
}

export interface ConceptResponse {
  readonly missionId: MissionId;
  readonly variantId: string;
  readonly kind: "CONCEPT";
  readonly selectedOptionId: string | null;
}

export type MissionResponse = MeasurementResponse | PlanningResponse | ConceptResponse;

export type ScoreComponentId =
  | "DISTANCE"
  | "DISPLACEMENT_MAGNITUDE"
  | "DISPLACEMENT_DIRECTION"
  | "ROUTE_CONSTRAINT"
  | "CONCEPT";

export interface ScoreComponent {
  readonly id: ScoreComponentId;
  readonly earned: number;
  readonly possible: number;
  readonly correct: boolean;
}

export interface MissionScore {
  readonly missionId: MissionId;
  readonly variantId: string;
  readonly earned: number;
  readonly possible: number;
  readonly components: readonly ScoreComponent[];
  readonly misconceptions: readonly MisconceptionCode[];
}

export type MasteryTier = 1 | 2 | 3 | 4 | 5;

export interface MasteryResult {
  readonly tier: MasteryTier;
  readonly label: "Beginning" | "Developing" | "Approaching" | "Proficient" | "Mastered";
  readonly classPointsCue: MasteryTier;
  readonly coreGateApplied: boolean;
}

export interface AssessmentScore {
  readonly score: number;
  readonly max: 20;
  readonly percent: number;
  readonly directionScore: number;
  readonly directionMax: 5;
  readonly c3Correct: boolean;
  readonly rawTier: MasteryTier;
  readonly masteryTier: MasteryTier;
  readonly capReason: "DIRECTION_GATE" | "C3_GATE" | "DIRECTION_AND_C3_GATES" | null;
  readonly classPointsCue: MasteryTier;
  readonly itemResults: readonly MissionScore[];
  readonly misconceptions: readonly MisconceptionCode[];
}

export interface AssessmentVariantManifest {
  readonly seed: string;
  readonly missions: readonly AssessmentMission[];
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface RouteConstraintResult {
  readonly valid: boolean;
  readonly reachesGoal: boolean;
  readonly checkpointsVisitedInOrder: boolean;
  readonly avoidsObstacles: boolean;
  readonly staysInBounds: boolean;
  readonly withinCommandLimit: boolean;
  readonly issues: readonly string[];
}
