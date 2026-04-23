import { TestBed } from '@angular/core/testing';
import type { SavedVideo } from '../models/saved-video';
import { StorageError, StorageErrorKind } from '../models/storage-error';
import { VIDEOS_DB_NAME, VideosDB } from '../db/videos-db';
import { VIDEOS_DB, VideoStorageService, mapDexieError } from './video-storage.service';

function makeRecord(overrides: Partial<SavedVideo> = {}): SavedVideo {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    blob: overrides.blob ?? new Blob(['x'], { type: 'video/webm' }),
    mimeType: overrides.mimeType ?? 'video/webm;codecs=vp9',
    duration: overrides.duration ?? 3.2,
    recordedAt: overrides.recordedAt ?? new Date(),
    resolution: overrides.resolution ?? '720p',
  };
}

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(VIDEOS_DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = (): void => resolve();
  });
}

describe('VideoStorageService', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  describe('with a live Dexie DB', () => {
    let service: VideoStorageService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      service = TestBed.inject(VideoStorageService);
    });

    it('save() then listAll() round-trips the record', async () => {
      const record = makeRecord();
      await service.save(record);

      const { items, skippedCount } = await service.listAll();
      expect(skippedCount).toBe(0);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(record.id);
      expect(items[0]?.mimeType).toBe('video/webm;codecs=vp9');
      expect(items[0]?.resolution).toBe('720p');
    });

    it('listAll() returns newest-first by recordedAt', async () => {
      const older = makeRecord({ recordedAt: new Date('2026-01-01T00:00:00Z') });
      const newer = makeRecord({ recordedAt: new Date('2026-02-01T00:00:00Z') });
      await service.save(older);
      await service.save(newer);

      const { items } = await service.listAll();
      expect(items.map((i) => i.id)).toEqual([newer.id, older.id]);
    });

    it('deleteById() removes a row', async () => {
      const a = makeRecord();
      const b = makeRecord();
      await service.save(a);
      await service.save(b);

      await service.deleteById(a.id);
      const { items } = await service.listAll();
      expect(items.map((i) => i.id)).toEqual([b.id]);
    });

    it('deleteById() with an unknown id resolves without error', async () => {
      await expect(service.deleteById('does-not-exist')).resolves.toBeUndefined();
    });

    it('listAll() skips corrupt rows and counts them', async () => {
      const valid = makeRecord();
      await service.save(valid);

      const directDb = new VideosDB();
      await directDb.videos.add({
        id: 'bad',
        blob: 'not-a-blob',
        mimeType: 42,
        duration: 'no',
        recordedAt: 'invalid',
        resolution: 'ultra',
      } as unknown as SavedVideo);
      directDb.close();

      const { items, skippedCount } = await service.listAll();
      expect(items.map((i) => i.id)).toEqual([valid.id]);
      expect(skippedCount).toBe(1);
    });
  });

  describe('when IndexedDB is unavailable', () => {
    it('save() rejects with Unavailable', async () => {
      TestBed.configureTestingModule({
        providers: [{ provide: VIDEOS_DB, useValue: null }],
      });
      const service = TestBed.inject(VideoStorageService);

      await expect(service.save(makeRecord())).rejects.toMatchObject({
        kind: StorageErrorKind.Unavailable,
      });
    });

    it('listAll() rejects with Unavailable', async () => {
      TestBed.configureTestingModule({
        providers: [{ provide: VIDEOS_DB, useValue: null }],
      });
      const service = TestBed.inject(VideoStorageService);

      await expect(service.listAll()).rejects.toMatchObject({
        kind: StorageErrorKind.Unavailable,
      });
    });
  });

  describe('mapDexieError', () => {
    it('passes through existing StorageError', () => {
      const original = new StorageError(StorageErrorKind.Unknown, 'x');
      expect(mapDexieError(original)).toBe(original);
    });

    it('maps QuotaExceededError to QuotaExceeded', () => {
      const mapped = mapDexieError(new DOMException('quota', 'QuotaExceededError'));
      expect(mapped).toBeInstanceOf(StorageError);
      expect(mapped.kind).toBe(StorageErrorKind.QuotaExceeded);
    });

    it('maps InvalidStateError to Unavailable', () => {
      const mapped = mapDexieError(new DOMException('gone', 'InvalidStateError'));
      expect(mapped.kind).toBe(StorageErrorKind.Unavailable);
    });

    it('falls back to Unknown for everything else', () => {
      expect(mapDexieError(new Error('huh')).kind).toBe(StorageErrorKind.Unknown);
      expect(mapDexieError('not-an-error').kind).toBe(StorageErrorKind.Unknown);
    });
  });
});
