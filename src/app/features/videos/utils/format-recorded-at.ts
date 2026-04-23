/**
 * Formats a `Date` as `DD.MM.YYYY HH:mm` in the host's local timezone, with
 * zero-padded fields. The Figma design fixes this format across the saved-video
 * cards.
 *
 * @param date - Any `Date` instance.
 * @returns A ten-to-sixteen character string like `'31.01.2025 13:30'`.
 * @example
 * formatRecordedAt(new Date(2025, 0, 31, 13, 30)); // '31.01.2025 13:30'
 */
export function formatRecordedAt(date: Date): string {
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
