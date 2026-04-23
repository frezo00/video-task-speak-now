import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('returns 0s for zero or negative values', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-1)).toBe('0s');
  });

  it('rounds sub-second durations up to 1s', () => {
    expect(formatDuration(0.1)).toBe('1s');
    expect(formatDuration(0.5)).toBe('1s');
    expect(formatDuration(0.9)).toBe('1s');
  });

  it('rounds to the nearest whole second for values above 1s', () => {
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(1.4)).toBe('1s');
    expect(formatDuration(1.5)).toBe('2s');
    expect(formatDuration(7.2)).toBe('7s');
  });

  it('formats the recorder hard cap cleanly', () => {
    expect(formatDuration(10)).toBe('10s');
  });

  it('returns 0s for non-finite inputs', () => {
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});
