import { CameraError, CameraErrorKind } from '../models/camera-error';
import { DEFAULT_CAMERA_CONSTRAINTS } from '../models/camera-constraints';
import { CameraService } from './camera.service';

interface TrackStub {
  readonly stop: ReturnType<typeof vi.fn>;
}

interface StreamHarness {
  readonly stream: MediaStream;
  readonly tracks: readonly TrackStub[];
}

function makeStreamStub(trackCount = 1): StreamHarness {
  const tracks: TrackStub[] = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }));
  const stream = { getTracks: (): readonly TrackStub[] => tracks } as unknown as MediaStream;
  return { stream, tracks };
}

describe('CameraService', () => {
  let service: CameraService;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    getUserMedia = vi.fn();
    originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: { getUserMedia },
    });
    service = new CameraService();
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'mediaDevices', originalDescriptor);
    } else {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    }
  });

  it('openStream happy path: idle → opening → live and exposes stream + clears error', async () => {
    const { stream } = makeStreamStub();
    getUserMedia.mockResolvedValueOnce(stream);
    expect(service.$status()).toBe('idle');

    const resolved = await service.openStream(DEFAULT_CAMERA_CONSTRAINTS);

    expect(resolved).toBe(stream);
    expect(service.$stream()).toBe(stream);
    expect(service.$status()).toBe('live');
    expect(service.$error()).toBeNull();
    expect(getUserMedia).toHaveBeenCalledWith(DEFAULT_CAMERA_CONSTRAINTS);
  });

  it('NotAllowedError maps to permission-denied and rejects with CameraError', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));

    await expect(service.openStream(DEFAULT_CAMERA_CONSTRAINTS)).rejects.toBeInstanceOf(
      CameraError,
    );
    expect(service.$error()?.kind).toBe(CameraErrorKind.PermissionDenied);
    expect(service.$status()).toBe('error');
    expect(service.$stream()).toBeNull();
  });

  it('NotFoundError maps to device-not-found', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('none', 'NotFoundError'));

    await expect(service.openStream(DEFAULT_CAMERA_CONSTRAINTS)).rejects.toMatchObject({
      kind: CameraErrorKind.DeviceNotFound,
    });
    expect(service.$error()?.kind).toBe(CameraErrorKind.DeviceNotFound);
  });

  it('OverconstrainedError maps to overconstrained', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('too much', 'OverconstrainedError'));

    await expect(service.openStream(DEFAULT_CAMERA_CONSTRAINTS)).rejects.toMatchObject({
      kind: CameraErrorKind.Overconstrained,
    });
  });

  it('NotReadableError maps to in-use', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('busy', 'NotReadableError'));

    await expect(service.openStream(DEFAULT_CAMERA_CONSTRAINTS)).rejects.toMatchObject({
      kind: CameraErrorKind.InUse,
    });
  });

  it('non-DOMException rejection maps to unknown', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('random failure'));

    await expect(service.openStream(DEFAULT_CAMERA_CONSTRAINTS)).rejects.toMatchObject({
      kind: CameraErrorKind.Unknown,
    });
  });

  it('closeStream stops every track and nulls the stream', async () => {
    const { stream, tracks } = makeStreamStub(2);
    getUserMedia.mockResolvedValueOnce(stream);
    await service.openStream(DEFAULT_CAMERA_CONSTRAINTS);

    service.closeStream();

    for (const track of tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
    expect(service.$stream()).toBeNull();
    expect(service.$status()).toBe('idle');
  });

  it('closeStream is idempotent', () => {
    expect(() => {
      service.closeStream();
      service.closeStream();
    }).not.toThrow();
    expect(service.$status()).toBe('idle');
  });

  it('openStream while live stops previous tracks before opening the new one', async () => {
    const first = makeStreamStub(1);
    const second = makeStreamStub(1);
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);

    await service.openStream(DEFAULT_CAMERA_CONSTRAINTS);
    await service.openStream(DEFAULT_CAMERA_CONSTRAINTS);

    for (const track of first.tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
    expect(service.$stream()).toBe(second.stream);
    expect(service.$status()).toBe('live');
  });
});
