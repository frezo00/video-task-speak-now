import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Actions, ofActionDispatched, provideStore, Store } from '@ngxs/store';
import { firstValueFrom, take } from 'rxjs';
import type { Mock } from 'vitest';
import { CameraService } from '@core/camera';
import { ErrorBannerService } from '@core/error';
import {
  Recording,
  RecorderService,
  RecordingError,
  RecordingErrorKind,
  type RecordingResult,
} from '@core/recorder';
import { VideoStorageService, type SavedVideo } from '@core/storage';
import { VideosState } from '@features/videos';
import { QualityState } from './quality.state';
import { RecorderState } from './recorder.state';

interface RecorderServiceStub {
  readonly start: Mock<(stream: MediaStream) => Promise<RecordingResult>>;
  readonly stop: Mock<() => void>;
}

interface CameraServiceStub {
  readonly $stream: ReturnType<typeof signal<MediaStream | null>>;
}

function setup(options: {
  readonly stream?: MediaStream | null;
  readonly startImpl?: (stream: MediaStream) => Promise<RecordingResult>;
}): {
  readonly store: Store;
  readonly actions$: Actions;
  readonly recorder: RecorderServiceStub;
  readonly camera: CameraServiceStub;
  readonly banner: ErrorBannerService;
} {
  const recorder: RecorderServiceStub = {
    start: vi.fn<(stream: MediaStream) => Promise<RecordingResult>>(),
    stop: vi.fn<() => void>(),
  };
  if (options.startImpl) {
    recorder.start.mockImplementation(options.startImpl);
  }
  const camera: CameraServiceStub = {
    $stream: signal<MediaStream | null>(options.stream ?? null),
  };
  const storage = {
    save: vi.fn<(record: SavedVideo) => Promise<SavedVideo>>((record) => Promise.resolve(record)),
    listAll: vi
      .fn<() => Promise<{ items: readonly SavedVideo[]; skippedCount: number }>>()
      .mockResolvedValue({ items: [], skippedCount: 0 }),
    deleteById: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      provideStore([RecorderState, VideosState, QualityState]),
      { provide: RecorderService, useValue: recorder },
      { provide: CameraService, useValue: camera },
      { provide: VideoStorageService, useValue: storage },
    ],
  });
  return {
    store: TestBed.inject(Store),
    actions$: TestBed.inject(Actions),
    recorder,
    camera,
    banner: TestBed.inject(ErrorBannerService),
  };
}

describe('RecorderState', () => {
  const stream = {} as MediaStream;
  const blob = new Blob(['x'], { type: 'video/webm' });
  const result: RecordingResult = { blob, mimeType: 'video/webm' };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('has idle defaults', () => {
    const { store } = setup({});
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
    expect(store.selectSnapshot(RecorderState.startedAt)).toBeNull();
  });

  it('Recording.Started with a stream transitions to recording, then idle on Completed', async () => {
    const { store, recorder } = setup({ stream, startImpl: () => Promise.resolve(result) });

    await firstValueFrom(store.dispatch(new Recording.Started()));

    expect(recorder.start).toHaveBeenCalledWith(stream);
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
    expect(store.selectSnapshot(RecorderState.startedAt)).toBeNull();
  });

  it('passes recording status through while the recorder is running', async () => {
    let resolveStart: (value: RecordingResult) => void = () => undefined;
    const pending = new Promise<RecordingResult>((resolve) => {
      resolveStart = resolve;
    });
    const { store } = setup({ stream, startImpl: () => pending });

    const dispatched = firstValueFrom(store.dispatch(new Recording.Started()));
    expect(store.selectSnapshot(RecorderState.status)).toBe('recording');
    expect(store.selectSnapshot(RecorderState.startedAt)).not.toBeNull();

    resolveStart(result);
    await dispatched;
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
  });

  it('Recording.Started with no stream dispatches Failed and pushes banner', async () => {
    const { store, banner, actions$ } = setup({ stream: null });
    const failed$ = firstValueFrom(actions$.pipe(ofActionDispatched(Recording.Failed), take(1)));

    await firstValueFrom(store.dispatch(new Recording.Started()));
    const action = await failed$;

    expect(action.error).toBeInstanceOf(RecordingError);
    expect((action.error as RecordingError).kind).toBe(RecordingErrorKind.NoStream);
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
    expect(banner.$items()).toHaveLength(1);
    expect(banner.$items()[0]?.level).toBe('error');
  });

  it('Recording.StopRequested while recording flips to stopping and calls RecorderService.stop', async () => {
    let resolveStart: (value: RecordingResult) => void = () => undefined;
    const pending = new Promise<RecordingResult>((resolve) => {
      resolveStart = resolve;
    });
    const { store, recorder } = setup({ stream, startImpl: () => pending });

    const dispatched = firstValueFrom(store.dispatch(new Recording.Started()));
    expect(store.selectSnapshot(RecorderState.status)).toBe('recording');

    store.dispatch(new Recording.StopRequested());
    expect(store.selectSnapshot(RecorderState.status)).toBe('stopping');
    expect(recorder.stop).toHaveBeenCalledOnce();

    resolveStart(result);
    await dispatched;
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
  });

  it('Recording.StopRequested while idle is a no-op', () => {
    const { store, recorder } = setup({});

    store.dispatch(new Recording.StopRequested());

    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
    expect(recorder.stop).not.toHaveBeenCalled();
  });

  it('Recording.StopRequested while stopping is a no-op', async () => {
    let resolveStart: (value: RecordingResult) => void = () => undefined;
    const pending = new Promise<RecordingResult>((resolve) => {
      resolveStart = resolve;
    });
    const { store, recorder } = setup({ stream, startImpl: () => pending });

    const dispatched = firstValueFrom(store.dispatch(new Recording.Started()));
    store.dispatch(new Recording.StopRequested());
    expect(store.selectSnapshot(RecorderState.status)).toBe('stopping');

    store.dispatch(new Recording.StopRequested());
    expect(recorder.stop).toHaveBeenCalledOnce();

    resolveStart(result);
    await dispatched;
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
  });

  it('Recording.Failed resets state, pushes error banner, logs the error', async () => {
    const err = new RecordingError(RecordingErrorKind.MediaError, 'boom');
    const { store, recorder, banner } = setup({
      stream,
      startImpl: () => Promise.reject(err),
    });

    await firstValueFrom(store.dispatch(new Recording.Started()));

    expect(recorder.start).toHaveBeenCalled();
    expect(store.selectSnapshot(RecorderState.status)).toBe('idle');
    expect(store.selectSnapshot(RecorderState.startedAt)).toBeNull();
    expect(banner.$items()).toHaveLength(1);
    expect(banner.$items()[0]?.level).toBe('error');
  });

  it('double Recording.Started while recording no-ops the second', async () => {
    let calls = 0;
    let resolveFirst: (value: RecordingResult) => void = () => undefined;
    const { store, recorder } = setup({
      stream,
      startImpl: () => {
        calls += 1;
        return new Promise<RecordingResult>((resolve) => {
          resolveFirst = resolve;
        });
      },
    });

    const first = firstValueFrom(store.dispatch(new Recording.Started()));
    expect(store.selectSnapshot(RecorderState.status)).toBe('recording');

    await firstValueFrom(store.dispatch(new Recording.Started()));
    expect(calls).toBe(1);
    expect(recorder.start).toHaveBeenCalledOnce();

    resolveFirst(result);
    await first;
  });

  it('clamps recorded duration to RECORDING_HARD_CAP_MS (10.0 s max)', async () => {
    let currentTime = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => currentTime);
    const capturedBlob = new Blob(['x'], { type: 'video/webm' });
    const { store } = setup({
      stream,
      startImpl: () => {
        currentTime = 15_000;
        return Promise.resolve({ blob: capturedBlob, mimeType: 'video/webm' });
      },
    });

    await firstValueFrom(store.dispatch(new Recording.Started()));

    const items = store.selectSnapshot(VideosState.items);
    expect(items[0]?.duration).toBe(10.0);
    nowSpy.mockRestore();
  });

  it('Recording.Completed populates VideosState with the expected fields (integration)', async () => {
    const capturedBlob = new Blob(['recording-bytes'], { type: 'video/webm;codecs=vp9' });
    const { store } = setup({
      stream,
      startImpl: () => Promise.resolve({ blob: capturedBlob, mimeType: 'video/webm;codecs=vp9' }),
    });

    await firstValueFrom(store.dispatch(new Recording.Started()));

    const items = store.selectSnapshot(VideosState.items);
    expect(items).toHaveLength(1);
    const [saved] = items;
    expect(saved?.blob).toBe(capturedBlob);
    expect(saved?.mimeType).toBe('video/webm;codecs=vp9');
    expect(saved?.resolution).toBe('720p');
    expect(typeof saved?.duration).toBe('number');
  });
});
