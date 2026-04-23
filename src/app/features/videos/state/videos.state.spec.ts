import { TestBed } from '@angular/core/testing';
import { Actions, ofActionDispatched, provideStore, Store } from '@ngxs/store';
import { firstValueFrom, take } from 'rxjs';
import type { Mock } from 'vitest';
import { ErrorBannerService } from '@core/error';
import { Recording } from '@core/recorder';
import {
  StorageError,
  StorageErrorKind,
  storageErrorMessage,
  VideoStorageService,
  type SavedVideo,
} from '@core/storage';
import { Videos } from './videos.actions';
import { VideosState } from './videos.state';

interface VideoStorageServiceStub {
  readonly save: Mock<(record: SavedVideo) => Promise<SavedVideo>>;
  readonly listAll: Mock<() => Promise<{ items: readonly SavedVideo[]; skippedCount: number }>>;
  readonly deleteById: Mock<(id: string) => Promise<void>>;
}

function setup(
  options: {
    readonly saveImpl?: (record: SavedVideo) => Promise<SavedVideo>;
  } = {},
): {
  readonly store: Store;
  readonly actions$: Actions;
  readonly storage: VideoStorageServiceStub;
  readonly banner: ErrorBannerService;
} {
  const storage: VideoStorageServiceStub = {
    save: vi.fn<(record: SavedVideo) => Promise<SavedVideo>>(),
    listAll: vi
      .fn<() => Promise<{ items: readonly SavedVideo[]; skippedCount: number }>>()
      .mockResolvedValue({ items: [], skippedCount: 0 }),
    deleteById: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
  storage.save.mockImplementation(options.saveImpl ?? ((record) => Promise.resolve(record)));
  TestBed.configureTestingModule({
    providers: [provideStore([VideosState]), { provide: VideoStorageService, useValue: storage }],
  });
  return {
    store: TestBed.inject(Store),
    actions$: TestBed.inject(Actions),
    storage,
    banner: TestBed.inject(ErrorBannerService),
  };
}

function makeBlob(content = 'x'): Blob {
  return new Blob([content], { type: 'video/webm' });
}

describe('VideosState', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('starts with an empty items array', () => {
    const { store } = setup();
    expect(store.selectSnapshot(VideosState.items)).toEqual([]);
  });

  describe('on Recording.Completed', () => {
    it('writes to storage and prepends on success', async () => {
      const { store, storage } = setup();
      const blob = makeBlob();

      await firstValueFrom(
        store.dispatch(new Recording.Completed(blob, 5.0, 'video/webm', '720p')),
      );

      expect(storage.save).toHaveBeenCalledTimes(1);
      const saved = storage.save.mock.calls[0]?.[0];
      expect(saved?.blob).toBe(blob);
      expect(saved?.duration).toBe(5.0);
      expect(saved?.mimeType).toBe('video/webm');
      expect(saved?.resolution).toBe('720p');
      expect(typeof saved?.id).toBe('string');
      expect(saved?.recordedAt).toBeInstanceOf(Date);

      const items = store.selectSnapshot(VideosState.items);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(saved?.id);
    });

    it('orders newest first across multiple completions', async () => {
      const { store } = setup();
      const first = makeBlob('first');
      const second = makeBlob('second');

      await firstValueFrom(
        store.dispatch(new Recording.Completed(first, 3.0, 'video/webm', '360p')),
      );
      await firstValueFrom(
        store.dispatch(new Recording.Completed(second, 7.5, 'video/webm', '1080p')),
      );

      const items = store.selectSnapshot(VideosState.items);
      expect(items).toHaveLength(2);
      expect(items[0]?.blob).toBe(second);
      expect(items[1]?.blob).toBe(first);
    });

    it('dispatches Videos.Saved after a successful write', async () => {
      const { store, actions$ } = setup();
      const saved$ = firstValueFrom(actions$.pipe(ofActionDispatched(Videos.Saved), take(1)));

      await firstValueFrom(
        store.dispatch(new Recording.Completed(makeBlob(), 1.0, 'video/webm', '720p')),
      );

      const action = await saved$;
      expect(action.record.duration).toBe(1.0);
    });

    it('dispatches Videos.SaveFailed and omits from state when storage rejects', async () => {
      const quotaErr = new StorageError(StorageErrorKind.QuotaExceeded, 'full');
      const { store, actions$, banner } = setup({ saveImpl: () => Promise.reject(quotaErr) });
      const failed$ = firstValueFrom(actions$.pipe(ofActionDispatched(Videos.SaveFailed), take(1)));

      await firstValueFrom(
        store.dispatch(new Recording.Completed(makeBlob(), 1.0, 'video/webm', '720p')),
      );

      const action = await failed$;
      expect(action.error).toBe(quotaErr);
      expect(store.selectSnapshot(VideosState.items)).toHaveLength(0);
      const items = banner.$items();
      expect(items).toHaveLength(1);
      expect(items[0]?.level).toBe('error');
      expect(items[0]?.message).toBe(storageErrorMessage(quotaErr));
    });

    it('uses the save-context fallback copy for unknown-kind failures', async () => {
      const err = new StorageError(StorageErrorKind.Unknown, 'something broke');
      const { store, banner } = setup({ saveImpl: () => Promise.reject(err) });

      await firstValueFrom(
        store.dispatch(new Recording.Completed(makeBlob(), 1.0, 'video/webm', '720p')),
      );

      const items = banner.$items();
      expect(items).toHaveLength(1);
      expect(items[0]?.message).toBe(storageErrorMessage(err));
    });
  });

  describe('on Videos.Hydrated', () => {
    it('replaces items with the payload', async () => {
      const { store } = setup();
      const rec: SavedVideo = {
        id: 'seed-1',
        blob: makeBlob('seed'),
        mimeType: 'video/webm',
        duration: 2.0,
        recordedAt: new Date('2026-03-01T00:00:00Z'),
        resolution: '720p',
      };

      await firstValueFrom(store.dispatch(new Videos.Hydrated([rec], 0)));

      const items = store.selectSnapshot(VideosState.items);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe('seed-1');
    });

    it('pushes an info banner when skippedCount > 0', async () => {
      const { store, banner } = setup();

      await firstValueFrom(store.dispatch(new Videos.Hydrated([], 2)));

      const items = banner.$items();
      expect(items).toHaveLength(1);
      expect(items[0]?.level).toBe('info');
      expect(items[0]?.message).toContain('Some saved videos could not be loaded');
    });

    it('does not push a banner when skippedCount is 0', async () => {
      const { store, banner } = setup();

      await firstValueFrom(store.dispatch(new Videos.Hydrated([], 0)));

      expect(banner.$items()).toHaveLength(0);
    });
  });

  describe('on Videos.DeleteRequested', () => {
    async function seed(store: Store, ...ids: readonly string[]): Promise<readonly SavedVideo[]> {
      const records: readonly SavedVideo[] = ids.map((id, index) => ({
        id,
        blob: makeBlob(id),
        mimeType: 'video/webm',
        duration: 1000,
        recordedAt: new Date(Date.UTC(2026, 3, index + 1)),
        resolution: '720p',
      }));
      await firstValueFrom(store.dispatch(new Videos.Hydrated(records, 0)));
      return records;
    }

    it('calls storage.deleteById with the id and removes the item on success', async () => {
      const { store, storage } = setup();
      await seed(store, 'keep-1', 'drop-me', 'keep-2');

      await firstValueFrom(store.dispatch(new Videos.DeleteRequested('drop-me')));

      expect(storage.deleteById).toHaveBeenCalledTimes(1);
      expect(storage.deleteById).toHaveBeenCalledWith('drop-me');
      const items = store.selectSnapshot(VideosState.items);
      expect(items.map((i) => i.id)).toEqual(['keep-1', 'keep-2']);
    });

    it('dispatches Videos.Deleted with the id after a successful delete', async () => {
      const { store, actions$ } = setup();
      await seed(store, 'only');
      const deleted$ = firstValueFrom(actions$.pipe(ofActionDispatched(Videos.Deleted), take(1)));

      await firstValueFrom(store.dispatch(new Videos.DeleteRequested('only')));

      const action = await deleted$;
      expect(action.id).toBe('only');
    });

    it('dispatches Videos.DeleteFailed and leaves state untouched when deleteById rejects', async () => {
      const err = new StorageError(StorageErrorKind.Unknown, 'boom');
      const { store, actions$, storage } = setup();
      storage.deleteById.mockRejectedValueOnce(err);
      const records = await seed(store, 'keep', 'drop');
      const failed$ = firstValueFrom(
        actions$.pipe(ofActionDispatched(Videos.DeleteFailed), take(1)),
      );

      await firstValueFrom(store.dispatch(new Videos.DeleteRequested('drop')));

      const action = await failed$;
      expect(action.id).toBe('drop');
      expect(action.error).toBe(err);
      const items = store.selectSnapshot(VideosState.items);
      expect(items.map((i) => i.id)).toEqual(records.map((r) => r.id));
    });

    it('Videos.DeleteFailed pushes an error banner with the delete-context fallback copy', async () => {
      const err = new StorageError(StorageErrorKind.Unknown, 'boom');
      const { store, banner, storage } = setup();
      storage.deleteById.mockRejectedValueOnce(err);
      await seed(store, 'drop');

      await firstValueFrom(store.dispatch(new Videos.DeleteRequested('drop')));

      const items = banner.$items();
      expect(items).toHaveLength(1);
      expect(items[0]?.level).toBe('error');
      expect(items[0]?.message).toBe(storageErrorMessage(err, "Couldn't delete the video."));
      // Sanity: delete-context copy differs from the default save-context copy.
      expect(items[0]?.message).not.toBe(storageErrorMessage(err));
    });

    it('uses the fixed quota-exceeded copy regardless of context', async () => {
      const err = new StorageError(StorageErrorKind.QuotaExceeded, 'full');
      const { store, banner, storage } = setup();
      storage.deleteById.mockRejectedValueOnce(err);
      await seed(store, 'drop');

      await firstValueFrom(store.dispatch(new Videos.DeleteRequested('drop')));

      expect(banner.$items()[0]?.message).toBe(storageErrorMessage(err));
    });
  });
});
