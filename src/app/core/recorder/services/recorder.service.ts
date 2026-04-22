import { Injectable, signal } from '@angular/core';
import { PREFERRED_MIME_TYPES, RECORDING_HARD_CAP_MS } from '../models/recorder.constants';
import type { RecorderStatus } from '../models/recorder-status';
import { RecordingError, RecordingErrorKind } from '../models/recording-error';

interface PendingResolvers {
  readonly resolve: (blob: Blob) => void;
  readonly reject: (err: unknown) => void;
}

/**
 * Wraps a single `MediaRecorder` lifecycle. Each call to {@link start} owns an
 * independent recorder; {@link stop} releases it. A hard-cap timeout auto-stops
 * the recording after {@link RECORDING_HARD_CAP_MS}.
 */
@Injectable({ providedIn: 'root' })
export class RecorderService {
  readonly #$status = signal<RecorderStatus>('idle');

  readonly $status = this.#$status.asReadonly();

  #recorder: MediaRecorder | null = null;
  #chunks: Blob[] = [];
  #hardCapTimer: ReturnType<typeof setTimeout> | null = null;
  #pending: PendingResolvers | null = null;

  /**
   * Starts recording the given stream. Resolves with the captured Blob when the
   * recording stops (either via {@link stop} or the {@link RECORDING_HARD_CAP_MS}
   * hard cap). Rejects with a typed {@link RecordingError} on failure.
   *
   * @param stream - Live `MediaStream` from `getUserMedia`.
   * @returns Promise resolving to the recorded `Blob`.
   * @throws {RecordingError} `already-recording` when invoked while a recording
   *   is in progress; `unsupported-mime-type` when no preferred codec is
   *   supported; `media-error` when `MediaRecorder` fires `onerror`.
   */
  start(stream: MediaStream): Promise<Blob> {
    if (this.#recorder) {
      return Promise.reject(
        new RecordingError(
          RecordingErrorKind.AlreadyRecording,
          'A recording is already in progress',
        ),
      );
    }

    const mimeType = this.#pickMimeType();
    if (mimeType === null) {
      return Promise.reject(
        new RecordingError(
          RecordingErrorKind.UnsupportedMimeType,
          'No supported MediaRecorder mime type',
        ),
      );
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    this.#recorder = recorder;
    this.#chunks = [];
    this.#$status.set('recording');

    const promise = new Promise<Blob>((resolve, reject) => {
      this.#pending = { resolve, reject };
    });

    recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data && event.data.size > 0) {
        this.#chunks.push(event.data);
      }
    };
    recorder.onstop = (): void => {
      const blob = new Blob(this.#chunks, { type: recorder.mimeType });
      const pending = this.#pending;
      this.#cleanup();
      pending?.resolve(blob);
    };
    recorder.onerror = (event: Event): void => {
      const pending = this.#pending;
      this.#cleanup();
      pending?.reject(
        new RecordingError(RecordingErrorKind.MediaError, 'MediaRecorder error', { cause: event }),
      );
    };

    recorder.start();
    this.#hardCapTimer = setTimeout(() => this.stop(), RECORDING_HARD_CAP_MS);
    return promise;
  }

  /**
   * Stops the active recording. No-op when the service is idle.
   * The promise returned from {@link start} resolves once the recorder fires `onstop`.
   */
  stop(): void {
    const recorder = this.#recorder;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }
    this.#$status.set('stopping');
    recorder.stop();
  }

  #pickMimeType(): string | null {
    for (const type of PREFERRED_MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }

  #cleanup(): void {
    if (this.#hardCapTimer) {
      clearTimeout(this.#hardCapTimer);
      this.#hardCapTimer = null;
    }
    this.#recorder = null;
    this.#chunks = [];
    this.#pending = null;
    this.#$status.set('idle');
  }
}
