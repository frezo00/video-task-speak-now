import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { Overlay, type ConnectedPosition, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngxs/store';
import {
  Bandwidth,
  BandwidthState,
  constraintsFor,
  QUALITY_PROFILES,
  type QualityTier,
} from '@core/bandwidth';
import { CameraError, CameraErrorKind, CameraService } from '@core/camera';
import { ErrorBannerService } from '@core/error';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
  type DialogResult,
} from '@shared/confirm-dialog';
import { IconDirective } from '@shared/icons';
import { SpinnerComponent, SPINNER_DEBOUNCE_MS } from '@shared/spinner';
import { QualityMenuComponent } from '../../components/quality-menu/quality-menu.component';
import { OverrideRollbackReason, Quality, QualityState } from '../../state';
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

const QUALITY_MENU_POSITION: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'start',
  overlayY: 'bottom',
  offsetY: -8,
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
  readonly #overlay = inject(Overlay);
  readonly #banner = inject(ErrorBannerService);

  readonly $stream = this.#camera.$stream;
  readonly $bandwidthStatus = this.#store.selectSignal(BandwidthState.status);
  readonly $qualityTier = this.#store.selectSignal(QualityState.tier);

  readonly #$showSpinner = signal<boolean>(false);
  readonly $showSpinner = this.#$showSpinner.asReadonly();

  readonly #$qualityMenuOpen = signal<boolean>(false);
  readonly $qualityMenuOpen = this.#$qualityMenuOpen.asReadonly();

  readonly $gearEl = viewChild<ElementRef<HTMLButtonElement>>('gearBtn');

  #activeDialog: DialogRef<DialogResult> | null = null;
  #spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  #lastBootedTier: QualityTier | null = null;
  #qualityMenuRef: OverlayRef | null = null;
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
  }

  ngOnInit(): void {
    this.#spinnerTimer = setTimeout(() => this.#$showSpinner.set(true), SPINNER_DEBOUNCE_MS);
    this.#store.dispatch(new Bandwidth.MeasurementRequested());
    this.#destroyRef.onDestroy(() => {
      this.#stopSpinner();
      this.#qualityMenuRef?.dispose();
      this.#qualityMenuRef = null;
      this.#camera.closeStream();
    });
  }

  openQualityMenu(): void {
    if (this.#qualityMenuRef) {
      return;
    }
    const gear = this.$gearEl();
    if (!gear) {
      return;
    }
    const positionStrategy = this.#overlay
      .position()
      .flexibleConnectedTo(gear.nativeElement)
      .withPositions([QUALITY_MENU_POSITION])
      .withPush(true);
    const ref = this.#overlay.create({
      positionStrategy,
      scrollStrategy: this.#overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
      panelClass: 'quality-menu-panel',
    });
    this.#qualityMenuRef = ref;
    const portal = new ComponentPortal(QualityMenuComponent);
    const componentRef = ref.attach(portal);
    componentRef.setInput('selected', this.$qualityTier());
    // OutputEmitterRef subscriptions are cleaned up when the attached component
    // is destroyed (overlay dispose); no manual takeUntilDestroyed needed.
    componentRef.instance.$qualitySelected.subscribe((tier) => {
      void this.#applyOverride(tier);
    });
    componentRef.instance.$closed.subscribe(() => this.#closeQualityMenu());
    ref
      .outsidePointerEvents()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#closeQualityMenu());
    this.#$qualityMenuOpen.set(true);
  }

  async #bootCamera(tier: QualityTier): Promise<void> {
    try {
      await this.#camera.openStream(constraintsFor(tier));
    } catch (err) {
      this.#handleError(err);
    }
  }

  async #applyOverride(tier: QualityTier): Promise<void> {
    this.#closeQualityMenu();
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

  #closeQualityMenu(): void {
    if (!this.#qualityMenuRef) {
      return;
    }
    this.#qualityMenuRef.dispose();
    this.#qualityMenuRef = null;
    this.#$qualityMenuOpen.set(false);
    this.$gearEl()?.nativeElement.focus();
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
    this.#$showSpinner.set(false);
  }
}
