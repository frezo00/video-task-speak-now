import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RECORDING_HARD_CAP_MS, type RecorderStatus } from '@core/recorder';

@Component({
  selector: 'app-recorder-controls',
  templateUrl: './recorder-controls.component.html',
  styleUrl: './recorder-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'controls',
    role: 'toolbar',
    'aria-label': 'Recording controls',
  },
})
export class RecorderControlsComponent {
  readonly $status = input.required<RecorderStatus>({ alias: 'status' });
  readonly $startedAt = input<number | null>(null, { alias: 'startedAt' });

  readonly $startRequested = output<void>({ alias: 'startRequested' });
  readonly $stopRequested = output<void>({ alias: 'stopRequested' });

  readonly #destroyRef = inject(DestroyRef);
  readonly #$elapsedMs = signal<number>(0);

  readonly $progressPct = computed<number>(() => {
    const ratio = Math.min(this.#$elapsedMs() / RECORDING_HARD_CAP_MS, 1);
    return Math.round(ratio * 100);
  });

  readonly $timerText = computed<string>(() => `${(this.#$elapsedMs() / 1000).toFixed(1)} s`);

  readonly $announcedSeconds = computed<number>(() => Math.floor(this.#$elapsedMs() / 1000));

  constructor() {
    let rafId: number | null = null;
    const cancel = (): void => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    effect(() => {
      const startedAt = this.$startedAt();
      cancel();
      if (startedAt === null) {
        this.#$elapsedMs.set(0);
        return;
      }
      const tick = (): void => {
        this.#$elapsedMs.set(performance.now() - startedAt);
        rafId = requestAnimationFrame(tick);
      };
      tick();
    });
    this.#destroyRef.onDestroy(cancel);
  }

  onStartClick(): void {
    this.$startRequested.emit();
  }

  onStopClick(): void {
    this.$stopRequested.emit();
  }
}
