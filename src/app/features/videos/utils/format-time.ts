/**
 * Formats a time offset in seconds as `'MM:SS'` for the playback scrubber
 * (e.g. `'00:03'`, `'01:27'`). Both fields are zero-padded to two digits to
 * match the Figma UI kit.
 *
 * @param seconds - Time offset in seconds. Non-finite or negative values
 *   return `'00:00'`.
 * @returns A label shaped like `'MM:SS'`.
 * @example
 * formatTime(0);    // '00:00'
 * formatTime(7);    // '00:07'
 * formatTime(87);   // '01:27'
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }
  const whole = Math.floor(seconds);
  const mm = Math.floor(whole / 60)
    .toString()
    .padStart(2, '0');
  const ss = (whole % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}
