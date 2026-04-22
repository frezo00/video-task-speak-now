import { Injectable, signal } from '@angular/core';
import type { CameraError } from '../models/camera-error';
import type { CameraStatus } from '../models/camera-status';
import { classifyCameraError } from '../utils/classify-camera-error';

/**
 * Owns the lifecycle of a single `MediaStream` via `getUserMedia`.
 *
 * State is exposed as signals for reactive consumers; `openStream()` also
 * rejects with a typed `CameraError` so callers can branch imperatively
 * (e.g. to open a dialog) without setting up signal effects.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  readonly #$stream = signal<MediaStream | null>(null);
  readonly #$status = signal<CameraStatus>('idle');
  readonly #$error = signal<CameraError | null>(null);

  readonly $stream = this.#$stream.asReadonly();
  readonly $status = this.#$status.asReadonly();
  readonly $error = this.#$error.asReadonly();

  #openPromise: Promise<MediaStream> | null = null;

  /**
   * Opens a `MediaStream` for the given constraints and transitions the service
   * from `idle`/`error` → `opening` → `live`. Rejects with a typed `CameraError`
   * on failure; callers can branch on `CameraError.kind` without inspecting the
   * underlying `DOMException`.
   *
   * Concurrent calls share a single in-flight request — while a call is pending,
   * subsequent invocations return the same promise and **ignore the constraints
   * they were passed**. Callers that need to switch constraints should `await`
   * the current open (or call `closeStream()`) before issuing a new one.
   */
  async openStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
    if (this.#openPromise) {
      return this.#openPromise;
    }

    if (this.#$stream()) {
      this.closeStream();
    }

    this.#$status.set('opening');
    this.#$error.set(null);

    const promise = this.#requestStream(constraints);
    this.#openPromise = promise;
    try {
      return await promise;
    } finally {
      this.#openPromise = null;
    }
  }

  closeStream(): void {
    const stream = this.#$stream();
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      this.#$stream.set(null);
    }
    if (this.#$status() !== 'idle') {
      this.#$status.set('idle');
    }
  }

  async #requestStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.#$stream.set(stream);
      this.#$status.set('live');
      return stream;
    } catch (err) {
      const error = classifyCameraError(err);
      this.#$error.set(error);
      this.#$status.set('error');
      throw error;
    }
  }
}
