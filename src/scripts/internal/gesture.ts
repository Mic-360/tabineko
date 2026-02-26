/**
 * gesture.ts — TabiNeko gesture detection engine
 *
 * Handles the gesture state machine, cardinal direction detection,
 * circle detection, and returns a gesture signature string.
 *
 * Gesture signatures:
 *   "R"      → Go forward
 *   "L"      → Go back
 *   "U"      → Scroll to top
 *   "D"      → Scroll to bottom
 *   "R,D"    → Next tab
 *   "L,U"    → Previous tab
 *   "CIRCLE" → Refresh page
 */

// ─── Type Definitions ───────────────────────────────────────────

/** Cardinal direction */
type Direction = 'U' | 'D' | 'L' | 'R';

/** Possible gesture results */
type GestureSignature = 'U' | 'D' | 'L' | 'R' | 'R,D' | 'L,U' | 'CIRCLE' | null;

/** 2D point */
interface Point {
  x: number;
  y: number;
}

/** Gesture tracker configuration */
interface GestureConfig {
  /** Minimum px movement before registering a direction change */
  directionThreshold: number;
  /** Minimum accumulated angle (degrees) for circle detection */
  circleAngleThreshold: number;
  /** Maximum distance between start and end point for a circle */
  circleClosureDistance: number;
  /** Minimum total path length for a valid circle */
  circleMinPathLength: number;
}

/** Internal state of the gesture tracker */
interface GestureState {
  isTracking: boolean;
  startPoint: Point | null;
  lastPoint: Point | null;
  /** Anchor point for direction threshold measurement */
  anchorPoint: Point | null;
  directions: Direction[];
  /** All sampled points along the path (for circle detection) */
  pathPoints: Point[];
  /** Accumulated total path length in pixels */
  totalPathLength: number;
  /** Accumulated signed angle change in degrees */
  accumulatedAngle: number;
  /** Whether a gesture was actually recognized */
  gestureDetected: boolean;
}

// ─── Default Configuration ──────────────────────────────────────

const DEFAULT_CONFIG: GestureConfig = {
  directionThreshold: 25,
  circleAngleThreshold: 300,
  circleClosureDistance: 80,
  circleMinPathLength: 150,
};

// ─── Utility Functions ──────────────────────────────────────────

/** Euclidean distance between two points */
function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the signed angle (in degrees) between two vectors.
 * Uses atan2 for proper quadrant handling. The sign indicates
 * rotation direction (positive = counter-clockwise).
 */
function angleBetweenVectors(v1: Point, v2: Point): number {
  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;
  return Math.atan2(cross, dot) * (180 / Math.PI);
}

// ─── Gesture Tracker Class ──────────────────────────────────────

export class GestureTracker {
  private config: GestureConfig;
  private state: GestureState;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /** Create a fresh state object */
  private createInitialState(): GestureState {
    return {
      isTracking: false,
      startPoint: null,
      lastPoint: null,
      anchorPoint: null,
      directions: [],
      pathPoints: [],
      totalPathLength: 0,
      accumulatedAngle: 0,
      gestureDetected: false,
    };
  }

  /** Begin tracking a gesture from a starting position */
  start(x: number, y: number): void {
    this.state = this.createInitialState();
    this.state.isTracking = true;
    const point: Point = { x, y };
    this.state.startPoint = point;
    this.state.lastPoint = point;
    this.state.anchorPoint = point;
    this.state.pathPoints.push(point);
  }

  /** Process a mouse move event during tracking */
  move(x: number, y: number): void {
    if (
      !this.state.isTracking ||
      !this.state.lastPoint ||
      !this.state.anchorPoint
    ) {
      return;
    }

    const current: Point = { x, y };
    const prev = this.state.lastPoint;

    // Accumulate path length for circle detection
    const segmentLength = distance(prev, current);
    this.state.totalPathLength += segmentLength;

    // Accumulate angular change for circle detection.
    // We need at least 3 points to compute angle between consecutive segments.
    const pathLen = this.state.pathPoints.length;
    if (pathLen >= 2) {
      const p0 = this.state.pathPoints[pathLen - 2];
      const p1 = this.state.pathPoints[pathLen - 1];
      const v1: Point = { x: p1.x - p0.x, y: p1.y - p0.y };
      const v2: Point = { x: current.x - p1.x, y: current.y - p1.y };

      // Only accumulate angle if both vectors have meaningful length
      const v1Len = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const v2Len = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      if (v1Len > 2 && v2Len > 2) {
        const angle = angleBetweenVectors(v1, v2);
        this.state.accumulatedAngle += angle;
      }
    }

    // Sample path points (every ~5px to avoid excessive memory use)
    if (segmentLength > 5) {
      this.state.pathPoints.push(current);
    }

    this.state.lastPoint = current;

    // Direction detection: measure displacement from the anchor point
    const dx = x - this.state.anchorPoint.x;
    const dy = y - this.state.anchorPoint.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Only register a direction if movement exceeds threshold
    if (
      absDx < this.config.directionThreshold &&
      absDy < this.config.directionThreshold
    ) {
      return;
    }

    let newDirection: Direction;

    // Determine dominant axis
    if (absDx > absDy) {
      newDirection = dx > 0 ? 'R' : 'L';
    } else {
      newDirection = dy > 0 ? 'D' : 'U';
    }

    // Deduplicate: only add if different from the last registered direction
    const lastDirection =
      this.state.directions[this.state.directions.length - 1];
    if (newDirection !== lastDirection) {
      this.state.directions.push(newDirection);
      this.state.gestureDetected = true;
    }

    // Reset anchor to current position after registering a direction
    this.state.anchorPoint = current;
  }

  /**
   * End tracking and return the recognized gesture signature.
   * Returns null if no gesture was detected.
   */
  end(): GestureSignature {
    if (!this.state.isTracking) {
      return null;
    }

    this.state.isTracking = false;

    // Check circle gesture first (takes priority when matched)
    if (this.isCircle()) {
      return 'CIRCLE';
    }

    // No directions recorded → no gesture
    if (this.state.directions.length === 0) {
      return null;
    }

    // Build the comma-separated signature from recorded directions
    const signature = this.state.directions.join(',');

    // Match against known gesture patterns
    const validGestures: Record<string, GestureSignature> = {
      U: 'U',
      D: 'D',
      L: 'L',
      R: 'R',
      'R,D': 'R,D',
      'L,U': 'L,U',
    };

    return validGestures[signature] ?? null;
  }

  /**
   * Determine if the tracked path forms a circle.
   *
   * Criteria:
   * 1. Accumulated angular rotation exceeds ~300 degrees
   * 2. Start and end points are close together (< closure distance)
   * 3. Total path length exceeds minimum (prevents tiny accidental circles)
   */
  private isCircle(): boolean {
    if (!this.state.startPoint || !this.state.lastPoint) {
      return false;
    }

    const absAngle = Math.abs(this.state.accumulatedAngle);
    const closureDist = distance(this.state.startPoint, this.state.lastPoint);

    return (
      absAngle >= this.config.circleAngleThreshold &&
      closureDist < this.config.circleClosureDistance &&
      this.state.totalPathLength >= this.config.circleMinPathLength
    );
  }

  /** Whether a gesture was detected during this tracking session */
  get hasGesture(): boolean {
    if (!this.state.isTracking) {
      return this.state.gestureDetected || this.isCircle();
    }

    return (
      this.state.gestureDetected ||
      this.state.directions.length > 0 ||
      (this.state.totalPathLength > this.config.circleMinPathLength &&
        Math.abs(this.state.accumulatedAngle) >
          this.config.circleAngleThreshold * 0.5)
    );
  }

  /** Whether the tracker is currently active */
  get isActive(): boolean {
    return this.state.isTracking;
  }

  /** Current direction sequence (for debugging/display) */
  get currentDirections(): readonly Direction[] {
    return this.state.directions;
  }
}
