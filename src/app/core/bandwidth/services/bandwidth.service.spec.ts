import { BANDWIDTH_PROBE_BYTES, BANDWIDTH_PROBE_TIMEOUT_MS } from '../models/bandwidth.constants';
import { BandwidthError, BandwidthErrorKind } from '../models/bandwidth-error';
import { BandwidthService } from './bandwidth.service';

interface ConnectionStub {
  readonly downlink?: number;
}

function setConnection(value: ConnectionStub | undefined): PropertyDescriptor | undefined {
  const original = Object.getOwnPropertyDescriptor(navigator, 'connection');
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    writable: true,
    value,
  });
  return original;
}

function restoreConnection(original: PropertyDescriptor | undefined): void {
  if (original) {
    Object.defineProperty(navigator, 'connection', original);
  } else {
    Reflect.deleteProperty(navigator, 'connection');
  }
}

function makeOkResponse(): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(BANDWIDTH_PROBE_BYTES)),
  } as unknown as Response;
}

describe('BandwidthService', () => {
  let service: BandwidthService;
  let fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  let originalConnection: PropertyDescriptor | undefined;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    service = new BandwidthService();
    fetchMock = vi.fn<typeof globalThis.fetch>();
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    originalConnection = setConnection(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreConnection(originalConnection);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('measure', () => {
    it('returns navigator.connection.downlink when API present and downlink > 0', async () => {
      restoreConnection(originalConnection);
      originalConnection = setConnection({ downlink: 7.5 });

      const result = await service.measure();

      expect(result).toBe(7.5);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('falls back to timed download when Network Information API is absent', async () => {
      restoreConnection(originalConnection);
      originalConnection = setConnection(undefined);
      const nowSpy = vi.spyOn(performance, 'now');
      // 3 samples: each takes 1s → 4 Mbps each → average 4.
      nowSpy
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(3000)
        .mockReturnValueOnce(4000)
        .mockReturnValueOnce(5000);
      fetchMock.mockResolvedValue(makeOkResponse());

      const result = await service.measure();

      expect(result).toBeCloseTo(4, 5);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('falls back when downlink is 0', async () => {
      restoreConnection(originalConnection);
      originalConnection = setConnection({ downlink: 0 });
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(500)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(2500);
      fetchMock.mockResolvedValue(makeOkResponse());

      const result = await service.measure();

      // 500ms per sample at 500_000 bytes → 8 Mbps.
      expect(result).toBeCloseTo(8, 5);
    });

    it('averages three samples', async () => {
      const nowSpy = vi.spyOn(performance, 'now');
      // Samples: 1s → 4 Mbps, 0.5s → 8 Mbps, 0.25s → 16 Mbps. Avg ≈ 9.333.
      nowSpy
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(2500)
        .mockReturnValueOnce(3000)
        .mockReturnValueOnce(3250);
      fetchMock.mockResolvedValue(makeOkResponse());

      const result = await service.measure();

      expect(result).toBeCloseTo((4 + 8 + 16) / 3, 5);
    });

    it('throws BandwidthError(probe-failed) when fetch returns non-200', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as Response);

      await expect(service.measure()).rejects.toBeInstanceOf(BandwidthError);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as Response);
      await expect(service.measure()).rejects.toMatchObject({
        kind: BandwidthErrorKind.ProbeFailed,
      });
    });

    it('throws BandwidthError(probe-timed-out) when fetch is aborted by the timeout', async () => {
      vi.useFakeTimers();
      fetchMock.mockImplementationOnce(
        (_input, init): Promise<Response> =>
          new Promise<Response>((_resolve, reject) => {
            const onAbort = (): void => {
              reject(new DOMException('aborted', 'AbortError'));
            };
            init?.signal?.addEventListener('abort', onAbort);
          }),
      );

      const measurePromise = service.measure();
      // Attach the rejection assertion before advancing time so the rejection
      // is consumed in the same microtask it's raised in (avoids a spurious
      // PromiseRejectionHandled warning).
      const expectation = expect(measurePromise).rejects.toMatchObject({
        kind: BandwidthErrorKind.ProbeTimedOut,
      });
      await vi.advanceTimersByTimeAsync(BANDWIDTH_PROBE_TIMEOUT_MS + 1);
      await expectation;
    });
  });

  describe('mapToQuality', () => {
    it('1.9 Mbps → low', () => {
      expect(service.mapToQuality(1.9)).toBe('low');
    });

    it('2.0 Mbps → medium', () => {
      expect(service.mapToQuality(2)).toBe('medium');
    });

    it('5.0 Mbps → medium (boundary)', () => {
      expect(service.mapToQuality(5)).toBe('medium');
    });

    it('5.01 Mbps → high', () => {
      expect(service.mapToQuality(5.01)).toBe('high');
    });

    it('100 Mbps → high', () => {
      expect(service.mapToQuality(100)).toBe('high');
    });
  });
});
