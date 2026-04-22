import { Injectable } from '@angular/core';
import {
  BANDWIDTH_PROBE_BYTES,
  BANDWIDTH_PROBE_SAMPLES,
  BANDWIDTH_PROBE_TIMEOUT_MS,
  BANDWIDTH_PROBE_URL,
} from '../models/bandwidth.constants';
import { BandwidthError, BandwidthErrorKind } from '../models/bandwidth-error';
import type { QualityTier } from '../models/quality-profile';

interface NetworkInformationLike {
  readonly downlink?: number;
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformationLike;
}

/**
 * Measures effective downlink and maps the result to a {@link QualityTier}.
 *
 * Tries `navigator.connection.downlink` first (Network Information API).
 * Falls back to averaging {@link BANDWIDTH_PROBE_SAMPLES} timed downloads of
 * {@link BANDWIDTH_PROBE_URL} when the API is missing or returns a non-positive
 * reading.
 */
@Injectable({ providedIn: 'root' })
export class BandwidthService {
  /**
   * @returns Throughput in megabits per second.
   * @throws {BandwidthError} When every probe attempt fails or times out.
   */
  async measure(): Promise<number> {
    const fromApi = this.#readNetworkInformation();
    if (fromApi !== null) {
      return fromApi;
    }
    return this.#timedDownload();
  }

  /**
   * Maps a measured Mbps reading to a tier using the assignment thresholds:
   * `<2 → low`, `2..5 → medium`, `>5 → high`.
   */
  mapToQuality(mbps: number): QualityTier {
    if (mbps < 2) {
      return 'low';
    }
    if (mbps > 5) {
      return 'high';
    }
    return 'medium';
  }

  #readNetworkInformation(): number | null {
    const connection = (navigator as NavigatorWithConnection).connection;
    const downlink = connection?.downlink;
    if (typeof downlink !== 'number' || downlink <= 0) {
      return null;
    }
    return downlink;
  }

  async #timedDownload(): Promise<number> {
    let total = 0;
    for (let i = 0; i < BANDWIDTH_PROBE_SAMPLES; i++) {
      total += await this.#probeOnce();
    }
    return total / BANDWIDTH_PROBE_SAMPLES;
  }

  async #probeOnce(): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BANDWIDTH_PROBE_TIMEOUT_MS);
    const startedAt = performance.now();
    try {
      const response = await fetch(BANDWIDTH_PROBE_URL, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BandwidthError(BandwidthErrorKind.ProbeFailed, `Probe HTTP ${response.status}`);
      }
      await response.arrayBuffer();
      const elapsedSec = (performance.now() - startedAt) / 1000;
      if (elapsedSec <= 0) {
        throw new BandwidthError(BandwidthErrorKind.ProbeFailed, 'Probe elapsed was zero');
      }
      return (BANDWIDTH_PROBE_BYTES * 8) / elapsedSec / 1_000_000;
    } catch (err) {
      if (err instanceof BandwidthError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new BandwidthError(BandwidthErrorKind.ProbeTimedOut, 'Probe timed out', {
          cause: err,
        });
      }
      throw new BandwidthError(BandwidthErrorKind.ProbeFailed, 'Probe failed', { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }
}
