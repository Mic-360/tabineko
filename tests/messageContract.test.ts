import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS } from '../src/scripts/shared';

describe('runtime message contracts', () => {
  test('has stable defaults for mapped gestures', () => {
    expect(DEFAULT_SETTINGS.gestures['R,D']).toBe('TAB_NEXT');
    expect(DEFAULT_SETTINGS.gestures['L,D']).toBe('TAB_PREV');
  });
});
