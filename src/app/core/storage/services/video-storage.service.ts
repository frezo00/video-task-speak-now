import { Injectable, InjectionToken, inject } from '@angular/core';
import { VIDEO_RESOLUTIONS, type SavedVideo, type VideoResolution } from '../models/saved-video';
import { StorageError, StorageErrorKind } from '../models/storage-error';
import { VideosDB } from '../db/videos-db';

export interface ListAllResult {
  readonly items: readonly SavedVideo[];
  readonly skippedCount: number;
}

/**
 * Injectable handle for the Dexie database. Returns `null` when IndexedDB is
 * unavailable (e.g. strict private mode) so {@link VideoStorageService} can
 * surface a typed `Unavailable` error without crashing the app on boot.
 */
export const VIDEOS_DB = new InjectionToken<VideosDB | null>('VIDEOS_DB', {
  providedIn: 'root',
  factory: (): VideosDB | null => {
    try {
      return new VideosDB();
    } catch (err) {
      console.warn('[storage] Dexie unavailable', err);
      return null;
    }
  },
});

const VIDEO_RESOLUTION_SET: ReadonlySet<VideoResolution> = new Set(VIDEO_RESOLUTIONS);

function isValidRow(row: unknown): row is SavedVideo {
  if (!row || typeof row !== 'object') {
    return false;
  }
  const candidate = row as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    candidate['blob'] !== null &&
    typeof candidate['blob'] === 'object' &&
    typeof candidate['mimeType'] === 'string' &&
    typeof candidate['duration'] === 'number' &&
    candidate['recordedAt'] instanceof Date &&
    typeof candidate['resolution'] === 'string' &&
    VIDEO_RESOLUTION_SET.has(candidate['resolution'] as VideoResolution)
  );
}

function collectErrorNames(err: unknown): readonly string[] {
  const names: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { name?: unknown; cause?: unknown; inner?: unknown };
    if (typeof candidate.name === 'string') {
      names.push(candidate.name);
    }
    current = candidate.cause ?? candidate.inner;
  }
  return names;
}

export function mapDexieError(err: unknown): StorageError {
  if (err instanceof StorageError) {
    return err;
  }
  const names = collectErrorNames(err);
  if (names.includes('QuotaExceededError')) {
    return new StorageError(StorageErrorKind.QuotaExceeded, 'Browser storage quota exceeded', {
      cause: err,
    });
  }
  if (names.includes('InvalidStateError')) {
    return new StorageError(StorageErrorKind.Unavailable, 'IndexedDB is unavailable', {
      cause: err,
    });
  }
  return new StorageError(StorageErrorKind.Unknown, 'Storage operation failed', { cause: err });
}

/**
 * Dexie-backed persistence for {@link SavedVideo} rows.
 */
@Injectable({ providedIn: 'root' })
export class VideoStorageService {
  readonly #db = inject(VIDEOS_DB);

  /**
   * Persists a fully-formed {@link SavedVideo}. Caller supplies the `id`; the
   * record is returned unchanged on success.
   *
   * @throws {StorageError} `quota-exceeded` when the browser storage quota is
   *   exceeded; `unavailable` when IndexedDB is unavailable; `unknown` for
   *   other Dexie errors.
   */
  async save(record: SavedVideo): Promise<SavedVideo> {
    const db = this.#requireDb();
    await this.#run(() => db.videos.add(record));
    return record;
  }

  /**
   * Returns every persisted video, sorted newest-first by `recordedAt`. Corrupt
   * rows that fail the shape check are skipped and counted via `skippedCount`.
   */
  async listAll(): Promise<ListAllResult> {
    const db = this.#requireDb();
    const rows = await this.#run<readonly unknown[]>(() =>
      db.videos.orderBy('recordedAt').reverse().toArray(),
    );
    const items: SavedVideo[] = [];
    let skippedCount = 0;
    for (const row of rows) {
      if (isValidRow(row)) {
        items.push(row);
      } else {
        skippedCount += 1;
        console.warn('[VideoStorageService] skipping corrupt row', row);
      }
    }
    return { items, skippedCount };
  }

  /**
   * Removes a single row. Resolves even if no row with that id exists.
   */
  async deleteById(id: string): Promise<void> {
    const db = this.#requireDb();
    await this.#run(() => db.videos.delete(id));
  }

  #requireDb(): VideosDB {
    if (!this.#db) {
      throw new StorageError(StorageErrorKind.Unavailable, 'IndexedDB is unavailable');
    }
    return this.#db;
  }

  async #run<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (err) {
      throw mapDexieError(err);
    }
  }
}
