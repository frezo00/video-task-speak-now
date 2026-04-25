import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  Bandwidth,
  BandwidthState,
  constraintsFor,
  QUALITY_PROFILES,
  type QualityTier,
} from '@core/bandwidth';
import { CameraError, CameraErrorKind, CameraService } from '@core/camera';
import { ErrorBannerService } from '@core/error';
import { Recording } from '@core/recorder';
import { VideosListComponent, VideosState } from '@features/videos';
import { Store } from '@ngxs/store';
import { MOBILE_BREAKPOINT } from '@shared/breakpoints';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
  type DialogResult,
} from '@shared/confirm-dialog';
import { IconDirective } from '@shared/icons';
import { SPINNER_DEBOUNCE_MS, SpinnerComponent } from '@shared/spinner';
import { map } from 'rxjs';
import { QualityMenuTriggerDirective } from '../../components/quality-menu/quality-menu-trigger.directive';
import { RecorderControlsComponent } from '../../components/recorder-controls/recorder-controls.component';
import { VideoPreviewComponent } from '../../components/video-preview/video-preview.component';
import { OverrideRollbackReason, Quality, QualityState, RecorderState } from '../../state';

const CAMERA_ERROR_DIALOGS: Record<CameraErrorKind, ConfirmDialogData> = {
  [CameraErrorKind.PermissionDenied]: {
    title: 'Camera access denied',
    body:
      'This app needs your camera to record videos, but access was blocked.\n' +
      "Open your browser's site settings, allow camera access for this page, then retry.",
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.DeviceNotFound]: {
    title: 'No camera detected',
    body: "We couldn't find a camera connected to this device.\n\nConnect a webcam, then retry.",
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.Overconstrained]: {
    title: 'Resolution not supported',
    body:
      'Your camera does not support the requested resolution.\n' +
      'Retry to try a compatible configuration.',
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.InUse]: {
    title: 'Camera in use',
    body: 'The camera is being used by another application.\n\nClose the other app, then retry.',
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
  [CameraErrorKind.Unknown]: {
    title: "Couldn't open the camera",
    body:
      'Something went wrong while opening the camera.\n' +
      'Retry — if the problem persists, reload the page.',
    confirmLabel: 'Retry',
    dismissLabel: 'Dismiss',
  },
};

@Component({
  selector: 'app-recorder-page',
  imports: [
    CdkTrapFocus,
    IconDirective,
    QualityMenuTriggerDirective,
    RecorderControlsComponent,
    SpinnerComponent,
    VideoPreviewComponent,
    VideosListComponent,
  ],
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
  readonly #banner = inject(ErrorBannerService);
  readonly #breakpoints = inject(BreakpointObserver);

  readonly $stream = this.#camera.$stream;
  readonly $bandwidthStatus = this.#store.selectSignal(BandwidthState.status);
  readonly $qualityTier = this.#store.selectSignal(QualityState.tier);
  readonly $recorderStatus = this.#store.selectSignal(RecorderState.status);
  readonly $recorderStartedAt = this.#store.selectSignal(RecorderState.startedAt);

  readonly #$videos = this.#store.selectSignal(VideosState.items);
  readonly $videosCount = computed<number>(() => this.#$videos().length);

  readonly #$showSpinner = signal<boolean>(false);
  readonly $showSpinner = this.#$showSpinner.asReadonly();

  readonly $isMobile = toSignal(
    this.#breakpoints.observe(MOBILE_BREAKPOINT).pipe(map((state) => state.matches)),
    { initialValue: false as boolean },
  );

  readonly #$drawerOpen = signal<boolean>(false);
  readonly $drawerOpen = this.#$drawerOpen.asReadonly();
  readonly $drawerActive = computed<boolean>(() => this.$isMobile() && this.#$drawerOpen());

  readonly $drawerChipEl = viewChild<ElementRef<HTMLButtonElement>>('drawerChip');

  #activeDialog: DialogRef<DialogResult> | null = null;
  #spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  #lastBootedTier: QualityTier | null = null;
  #previousTierBeforeOverride: QualityTier | null = null;

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
    effect(() => {
      // Close the drawer when viewport grows past mobile so focus isn't trapped
      // inside a drawer that's now part of the two-column layout.
      if (!this.$isMobile() && this.#$drawerOpen()) {
        this.#$drawerOpen.set(false);
      }
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

  onStartRecording(): void {
    this.#store.dispatch(new Recording.Started());
  }

  onStopRecording(): void {
    this.#store.dispatch(new Recording.StopRequested());
  }

  toggleDrawer(): void {
    this.#$drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    if (!this.#$drawerOpen()) return;
    this.#$drawerOpen.set(false);
    // CDK's cdkTrapFocusAutoCapture would normally restore focus to the
    // previously-focused element on deactivation, but the chip that opened
    // the drawer is still visible and is the right anchor either way.
    this.$drawerChipEl()?.nativeElement.focus();
  }

  async onQualitySelected(tier: QualityTier): Promise<void> {
    if (tier === this.$qualityTier()) {
      return;
    }
    this.#previousTierBeforeOverride = this.$qualityTier();
    this.#store.dispatch(new Quality.ManuallyOverridden(tier));
    this.#lastBootedTier = tier;
    try {
      await this.#camera.openStream(constraintsFor(tier));
    } catch (err) {
      this.#handleOverrideError(err);
    }
  }

  async #bootCamera(tier: QualityTier): Promise<void> {
    try {
      await this.#camera.openStream(constraintsFor(tier));
    } catch (err) {
      this.#handleError(err);
    }
  }

  #handleOverrideError(err: unknown): void {
    if (
      err instanceof CameraError &&
      err.kind === CameraErrorKind.Overconstrained &&
      this.#previousTierBeforeOverride
    ) {
      const fallback = this.#previousTierBeforeOverride;
      this.#previousTierBeforeOverride = null;
      this.#store.dispatch(
        new Quality.OverrideRolledBack(fallback, OverrideRollbackReason.Overconstrained),
      );
      this.#banner.push({
        level: 'warning',
        message: `Your camera doesn't support that resolution. Reverted to ${QUALITY_PROFILES[fallback].label}.`,
      });
      this.#lastBootedTier = fallback;
      void this.#camera.openStream(constraintsFor(fallback));
      return;
    }
    this.#handleError(err);
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
      {
        data,
        backdropClass: 'dialog-panel__backdrop',
      },
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
    this.#$showSpinner.set(false);
  }
}
