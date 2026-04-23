import { StorageError, StorageErrorKind } from '../models/storage-error';
import { storageErrorMessage } from './storage-error-message';

describe('storageErrorMessage', () => {
  it('maps quota-exceeded to the quota copy regardless of fallback', () => {
    const err = new StorageError(StorageErrorKind.QuotaExceeded, 'full');

    expect(storageErrorMessage(err)).toContain('Storage is full');
    expect(storageErrorMessage(err, 'ignored fallback')).toContain('Storage is full');
  });

  it('maps unavailable to the blocked-storage copy regardless of fallback', () => {
    const err = new StorageError(StorageErrorKind.Unavailable, 'gone');

    expect(storageErrorMessage(err)).toContain('blocking storage');
    expect(storageErrorMessage(err, 'ignored fallback')).toContain('blocking storage');
  });

  it('returns the default save-context fallback for unknown-kind StorageError', () => {
    const err = new StorageError(StorageErrorKind.Unknown, 'huh');

    expect(storageErrorMessage(err)).toBe("Couldn't save the recording.");
  });

  it('returns the provided fallback for unknown-kind StorageError', () => {
    const err = new StorageError(StorageErrorKind.Unknown, 'huh');

    expect(storageErrorMessage(err, 'hydration failed')).toBe('hydration failed');
  });

  it('returns the default fallback for non-StorageError values', () => {
    expect(storageErrorMessage(new Error('boom'))).toBe("Couldn't save the recording.");
    expect(storageErrorMessage('a string')).toBe("Couldn't save the recording.");
    expect(storageErrorMessage(null)).toBe("Couldn't save the recording.");
  });

  it('returns the provided fallback for non-StorageError values', () => {
    expect(storageErrorMessage(new Error('boom'), 'hydrate')).toBe('hydrate');
    expect(storageErrorMessage(undefined, 'hydrate')).toBe('hydrate');
  });
});
