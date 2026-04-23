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
});
