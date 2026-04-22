import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngxs/store';
import { Bandwidth, BandwidthState, constraintsFor, type QualityTier } from '@core/bandwidth';
import { CameraError, CameraErrorKind, CameraService } from '@core/camera';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
  type DialogResult,
} from '@shared/confirm-dialog';
import { IconDirective } from '@shared/icons';
import { SpinnerComponent, SPINNER_DEBOUNCE_MS } from '@shared/spinner';
import { QualityState } from '../../state';
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
  imports: [IconDirective, SpinnerComponent, VideoPreviewComponent],
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
  readonly #store = inject(Store);

  readonly $stream = this.#camera.$stream;
  readonly $bandwidthStatus = this.#store.selectSignal(BandwidthState.status);
  readonly $qualityTier = this.#store.selectSignal(QualityState.tier);

  readonly #$showSpinner = signal<boolean>(false);
  readonly $showSpinner = this.#$showSpinner.asReadonly();

  #activeDialog: DialogRef<DialogResult> | null = null;
  #spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  #lastBootedTier: QualityTier | null = null;

  constructor() {
    effect(() => {
      const status = this.$bandwidthStatus();
      if (status !== 'ready' && status !== 'failed') {
        return;
      }
      this.#stopSpinner();
      const tier = this.$qualityTier();
      if (tier === this.#lastBootedTier) {
        return;
      }
      this.#lastBootedTier = tier;
      void this.#bootCamera(tier);
    });
  }

  ngOnInit(): void {
    this.#spinnerTimer = setTimeout(() => this.#$showSpinner.set(true), SPINNER_DEBOUNCE_MS);
    this.#store.dispatch(new Bandwidth.MeasurementRequested());
    this.#destroyRef.onDestroy(() => {
      this.#stopSpinner();
      this.#camera.closeStream();
    });
  }

  async #bootCamera(tier: QualityTier): Promise<void> {
    try {
      await this.#camera.openStream(constraintsFor(tier));
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
        void this.#bootCamera(this.$qualityTier());
      }
    });
  }

  #stopSpinner(): void {
    if (this.#spinnerTimer) {
      clearTimeout(this.#spinnerTimer);
      this.#spinnerTimer = null;
    }
    if (this.#$showSpinner()) {
      this.#$showSpinner.set(false);
    }
  }
}
