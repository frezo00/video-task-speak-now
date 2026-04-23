import { formatTime } from './format-time';

describe('formatTime', () => {
  it('returns 00:00 for zero or negative values', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(-1)).toBe('00:00');
  });

  it('floors sub-second offsets to 00:00', () => {
    expect(formatTime(0.4)).toBe('00:00');
    expect(formatTime(0.9)).toBe('00:00');
  });

  it('zero-pads single-digit seconds', () => {
    expect(formatTime(3)).toBe('00:03');
    expect(formatTime(7.8)).toBe('00:07');
  });

  it('formats multi-digit seconds within a minute', () => {
    expect(formatTime(42)).toBe('00:42');
    expect(formatTime(59.9)).toBe('00:59');
  });

  it('formats offsets past a minute', () => {
    expect(formatTime(60)).toBe('01:00');
    expect(formatTime(87)).toBe('01:27');
    expect(formatTime(605)).toBe('10:05');
  });

  it('returns 00:00 for non-finite inputs', () => {
    expect(formatTime(Number.NaN)).toBe('00:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});
