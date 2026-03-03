import { describe, expect, test } from 'bun:test';
import { compressDirections } from '../src/scripts/internal/gestureCompression';

describe('compressDirections', () => {
  test('compresses into directional pattern', () => {
    const pattern = compressDirections(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 58, y: 0 },
        { x: 58, y: 34 },
      ],
      12
    );
    expect(pattern).toBe('R,D');
  });

  test('deduplicates repeated direction samples', () => {
    const pattern = compressDirections(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 45, y: 2 },
        { x: 70, y: 1 },
      ],
      10
    );
    expect(pattern).toBe('R');
  });
});
