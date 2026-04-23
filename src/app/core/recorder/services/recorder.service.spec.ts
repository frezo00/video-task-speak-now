import { PREFERRED_MIME_TYPES, RECORDING_HARD_CAP_MS } from '../models/recorder.constants';
import { RecordingError, RecordingErrorKind } from '../models/recording-error';
import { RecorderService } from './recorder.service';

type DataCallback = ((e: { data: Blob }) => void) | null;
type StopCallback = (() => void) | null;
type ErrorCallback = ((e: Event) => void) | null;

class FakeMediaRecorder {
  static lastInstance: FakeMediaRecorder | null = null;
  static supportedTypes = new Set<string>(PREFERRED_MIME_TYPES);

  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: DataCallback = null;
  onstop: StopCallback = null;
  onerror: ErrorCallback = null;

  constructor(
    readonly stream: MediaStream,
    readonly options?: MediaRecorderOptions,
  ) {
    this.mimeType = options?.mimeType ?? 'video/webm';
    FakeMediaRecorder.lastInstance = this;
  }

  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supportedTypes.has(type);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['chunk'], { type: this.mimeType }) });
      this.onstop?.();
    });
  }

  fireError(): void {
    this.state = 'inactive';
    this.onerror?.(new Event('error'));
  }
}

type MediaRecorderGlobals = Record<'MediaRecorder', typeof MediaRecorder | undefined>;

describe('RecorderService', () => {
  const stream = {} as MediaStream;
  const globals = globalThis as unknown as MediaRecorderGlobals;
  let originalMediaRecorder: typeof MediaRecorder | undefined;

  beforeEach(() => {
    FakeMediaRecorder.lastInstance = null;
    FakeMediaRecorder.supportedTypes = new Set<string>(PREFERRED_MIME_TYPES);
    originalMediaRecorder = globals.MediaRecorder;
    globals.MediaRecorder = FakeMediaRecorder as unknown as typeof MediaRecorder;
  });

  afterEach(() => {
    vi.useRealTimers();
    globals.MediaRecorder = originalMediaRecorder;
  });

  it('starts in idle status', () => {
    const service = new RecorderService();
    expect(service.$status()).toBe('idle');
  });

  it('start() transitions to recording and resolves with a Blob on manual stop', async () => {
    const service = new RecorderService();

    const promise = service.start(stream);
    expect(service.$status()).toBe('recording');

    service.stop();
    const blob = await promise;

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('video/webm;codecs=vp9');
    expect(service.$status()).toBe('idle');
  });

  it('hard-caps at RECORDING_HARD_CAP_MS and resolves', async () => {
    vi.useFakeTimers();
    const service = new RecorderService();

    const promise = service.start(stream);
    await vi.advanceTimersByTimeAsync(RECORDING_HARD_CAP_MS);
    vi.useRealTimers();
    const blob = await promise;

    expect(blob).toBeInstanceOf(Blob);
    expect(FakeMediaRecorder.lastInstance?.state).toBe('inactive');
    expect(service.$status()).toBe('idle');
  });

  it('manual stop before the cap clears the hard-cap timer', async () => {
    vi.useFakeTimers();
    const service = new RecorderService();

    const promise = service.start(stream);
    service.stop();
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    await promise;

    vi.useFakeTimers();
    const next = service.start(stream);
    expect(FakeMediaRecorder.lastInstance?.state).toBe('recording');
    service.stop();
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    await next;
  });

  it('stopping() status flips before onstop fires', async () => {
    const service = new RecorderService();
    const promise = service.start(stream);

    service.stop();
    expect(service.$status()).toBe('stopping');

    await promise;
    expect(service.$status()).toBe('idle');
  });

  it('onerror rejects with media-error RecordingError', async () => {
    const service = new RecorderService();

    const promise = service.start(stream);
    FakeMediaRecorder.lastInstance?.fireError();

    await expect(promise).rejects.toBeInstanceOf(RecordingError);
    await expect(promise).rejects.toMatchObject({ kind: RecordingErrorKind.MediaError });
    expect(service.$status()).toBe('idle');
  });

  it('second concurrent start() rejects with already-recording', async () => {
    const service = new RecorderService();
    const first = service.start(stream);

    await expect(service.start(stream)).rejects.toMatchObject({
      kind: RecordingErrorKind.AlreadyRecording,
    });

    service.stop();
    await first;
  });

  it('start() rejects with unsupported-mime-type when no preferred codec is supported', async () => {
    FakeMediaRecorder.supportedTypes = new Set<string>();
    const service = new RecorderService();

    await expect(service.start(stream)).rejects.toMatchObject({
      kind: RecordingErrorKind.UnsupportedMimeType,
    });
    expect(service.$status()).toBe('idle');
  });

  it('picks the first supported mime type in preference order', async () => {
    FakeMediaRecorder.supportedTypes = new Set<string>(['video/webm;codecs=vp8', 'video/webm']);
    const service = new RecorderService();

    const promise = service.start(stream);
    expect(FakeMediaRecorder.lastInstance?.options?.mimeType).toBe('video/webm;codecs=vp8');
    service.stop();
    await promise;
  });

  it('can start again after a completed recording', async () => {
    const service = new RecorderService();
    const first = service.start(stream);
    service.stop();
    await first;

    const second = service.start(stream);
    expect(service.$status()).toBe('recording');
    service.stop();
    await second;
    expect(service.$status()).toBe('idle');
  });

  it('stop() is a no-op when idle', () => {
    const service = new RecorderService();
    expect(() => service.stop()).not.toThrow();
    expect(service.$status()).toBe('idle');
  });

  it('does not wedge when MediaRecorder.start() throws synchronously', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- restoring the prototype method verbatim
    const originalStart = FakeMediaRecorder.prototype.start;
    const service = new RecorderService();
    try {
      FakeMediaRecorder.prototype.start = function throwOnStart(this: void): void {
        throw new DOMException('track ended', 'InvalidStateError');
      };
      await expect(service.start(stream)).rejects.toMatchObject({
        kind: RecordingErrorKind.MediaError,
      });
      expect(service.$status()).toBe('idle');
    } finally {
      FakeMediaRecorder.prototype.start = originalStart;
    }

    const second = service.start(stream);
    expect(service.$status()).toBe('recording');
    service.stop();
    await second;
    expect(service.$status()).toBe('idle');
  });

  it('rejects with media-error when the MediaRecorder constructor throws', async () => {
    class ThrowingMediaRecorder extends FakeMediaRecorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        throw new DOMException('stream not available', 'NotSupportedError');
      }
    }
    globals.MediaRecorder = ThrowingMediaRecorder as unknown as typeof MediaRecorder;
    const service = new RecorderService();

    await expect(service.start(stream)).rejects.toMatchObject({
      kind: RecordingErrorKind.MediaError,
    });
    expect(service.$status()).toBe('idle');
  });
});
