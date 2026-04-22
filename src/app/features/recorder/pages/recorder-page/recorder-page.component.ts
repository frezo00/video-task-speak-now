import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CameraError,
  CameraErrorKind,
  CameraService,
  DEFAULT_CAMERA_CONSTRAINTS,
} from '@core/camera';
import { IconDirective } from '@shared/icons';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
  type DialogResult,
} from '@shared/confirm-dialog';
import { VideoPreviewComponent } from '../../components/video-preview/video-preview.component';

const CAMERA_ERROR_DIALOGS: Record<CameraErrorKind, ConfirmDialogData> = {
  [CameraErrorKind.PermissionDenied]: {
    title: 'Camera access denied',
    body: [
      'This app needs your camera to record videos, but access was blocked.',
      "Open your browser's site settings, allow camera access for this page, then retry.",
    ],
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.DeviceNotFound]: {
    title: 'No camera detected',
    body: ["We couldn't find a camera connected to this device.", 'Connect a webcam, then retry.'],
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.Overconstrained]: {
    title: 'Resolution not supported',
    body: [
      'Your camera does not support the requested resolution.',
      'Retry to try a compatible configuration.',
    ],
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.InUse]: {
    title: 'Camera in use',
    body: ['The camera is being used by another application.', 'Close the other app, then retry.'],
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.Unknown]: {
    title: "Couldn't open the camera",
    body: [
      'Something went wrong while opening the camera.',
      'Retry — if the problem persists, reload the page.',
    ],
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
};

@Component({
  selector: 'app-recorder-page',
  imports: [IconDirective, VideoPreviewComponent],
  templateUrl: './recorder-page.component.html',
  styleUrl: './recorder-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'recorder-page',
  },
})
export class RecorderPageComponent implements OnInit {
  readonly #camera = inject(CameraService);
  readonly #dialog = inject(Dialog);
  readonly #destroyRef = inject(DestroyRef);

  readonly $stream = this.#camera.$stream;

  #activeDialog: DialogRef<DialogResult> | null = null;

  ngOnInit(): void {
    void this.#bootCamera();
    this.#destroyRef.onDestroy(() => this.#camera.closeStream());
  }

  async #bootCamera(): Promise<void> {
    try {
      await this.#camera.openStream(DEFAULT_CAMERA_CONSTRAINTS);
    } catch (err) {
      this.#handleError(err);
    }
  }

  #handleError(err: unknown): void {
    if (!(err instanceof CameraError)) {
      console.error('[camera] unexpected error', err);
      return;
    }
    this.#openRetryableDialog(CAMERA_ERROR_DIALOGS[err.kind]);
  }

  #openRetryableDialog(data: ConfirmDialogData): void {
    if (this.#activeDialog) {
      return;
    }
    const ref: DialogRef<DialogResult> = this.#dialog.open<DialogResult, ConfirmDialogData>(
      ConfirmDialogComponent,
      { data },
    );
    this.#activeDialog = ref;
    ref.closed.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((result) => {
      this.#activeDialog = null;
      if (result === 'confirm') {
        void this.#bootCamera();
      }
    });
  }
}
