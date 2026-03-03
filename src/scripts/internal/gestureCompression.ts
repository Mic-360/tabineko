import type { Direction } from '../shared';

export interface Point {
  x: number;
  y: number;
}

export interface CompressionConfig {
  directionThreshold: number;
}

export class GestureCompressor {
  private anchor: Point;
  private directions: Direction[] = [];
  private totalDistance = 0;

  constructor(start: Point, private readonly config: CompressionConfig) {
    this.anchor = start;
  }

  addPoint(point: Point): void {
    const dx = point.x - this.anchor.x;
    const dy = point.y - this.anchor.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const distance = Math.hypot(dx, dy);
    this.totalDistance += distance;

    if (
      absDx < this.config.directionThreshold &&
      absDy < this.config.directionThreshold
    ) {
      return;
    }

    const nextDirection: Direction =
      absDx > absDy ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
    if (this.directions.at(-1) !== nextDirection) {
      this.directions.push(nextDirection);
    }
    this.anchor = point;
  }

  getPattern(): string {
    return this.directions.join(',');
  }

  getDirections(): readonly Direction[] {
    return this.directions;
  }

  getDistance(): number {
    return this.totalDistance;
  }
}

export function compressDirections(points: Point[], threshold = 16): string {
  if (points.length === 0) return '';
  const compressor = new GestureCompressor(points[0], {
    directionThreshold: threshold,
  });
  for (const point of points.slice(1)) {
    compressor.addPoint(point);
  }
  return compressor.getPattern();
}
