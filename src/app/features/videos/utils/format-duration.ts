/**
 * Formats a recording duration in seconds as `'Ns'` (e.g. `'10s'`). The
 * recorder state stores duration with 0.1 s precision (see
 * `RecorderState.onStarted`); we round to the nearest whole second for the
 * sidebar label so it matches the Figma UI kit. Any non-zero value rounds up
 * to at least `'1s'`.
 *
 * @param seconds - Duration in seconds. Non-positive or non-finite values
 *   return `'0s'`.
 * @returns A short label like `'1s'`, `'7s'`, `'10s'`.
 * @example
 * formatDuration(9.5);  // '10s'
 * formatDuration(0.5);  // '1s'
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0s';
  }
  const whole = seconds < 1 ? 1 : Math.round(seconds);
  return `${whole}s`;
}
