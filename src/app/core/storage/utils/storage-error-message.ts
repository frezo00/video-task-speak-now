import { StorageError, StorageErrorKind } from '../models/storage-error';

const QUOTA_EXCEEDED_MESSAGE = 'Storage is full — delete some saved videos and try again.';
const UNAVAILABLE_MESSAGE = "Your browser is blocking storage. Recordings won't be saved.";
const DEFAULT_UNKNOWN_MESSAGE = "Couldn't save the recording.";

/**
 * Maps a {@link StorageError} (or any unknown thrown value) to user-facing
 * banner copy.
 *
 * `quota-exceeded` and `unavailable` have fixed, context-independent messages.
 * Every other input — including non-{@link StorageError} throws — returns
 * `unknownFallback`, which defaults to save-context copy.
 *
 * @param err - The caught error value. May be a {@link StorageError}, another
 *   `Error`, or any unknown value propagated from the storage layer.
 * @param unknownFallback - Banner copy to show when the error kind is `unknown`
 *   or the value isn't a {@link StorageError}. Use this on the hydration path to
 *   avoid save-centric phrasing (e.g. `"Couldn't load your saved recordings."`).
 * @returns A single-line string suitable for {@link ErrorBannerService}.
 * @example
 *   // save failure
 *   banner.push({ level: 'error', message: storageErrorMessage(err) });
 *
 *   // hydration failure (reads, not writes)
 *   banner.push({
 *     level: 'error',
 *     message: storageErrorMessage(err, "Couldn't load your saved recordings."),
 *   });
 */
export function storageErrorMessage(
  err: unknown,
  unknownFallback: string = DEFAULT_UNKNOWN_MESSAGE,
): string {
  if (err instanceof StorageError) {
    if (err.kind === StorageErrorKind.QuotaExceeded) {
      return QUOTA_EXCEEDED_MESSAGE;
    }
    if (err.kind === StorageErrorKind.Unavailable) {
      return UNAVAILABLE_MESSAGE;
    }
  }
  return unknownFallback;
}
