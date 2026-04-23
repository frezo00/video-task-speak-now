import { formatRecordedAt } from './format-recorded-at';

describe('formatRecordedAt', () => {
  it('zero-pads single-digit days and months', () => {
    expect(formatRecordedAt(new Date(2025, 0, 3, 9, 5))).toBe('03.01.2025 09:05');
  });

  it('formats two-digit fields without padding surprises', () => {
    expect(formatRecordedAt(new Date(2026, 10, 23, 14, 30))).toBe('23.11.2026 14:30');
  });

  it('renders midnight as 00:00', () => {
    expect(formatRecordedAt(new Date(2025, 11, 31, 0, 0))).toBe('31.12.2025 00:00');
  });

  it('handles the last minute of a year', () => {
    expect(formatRecordedAt(new Date(2025, 11, 31, 23, 59))).toBe('31.12.2025 23:59');
  });
});
