import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import type { SavedVideo } from '@core/storage';
import { IconDirective } from '@shared/icons';
import { formatRecordedAt } from '../../utils/format-recorded-at';
import { formatTime } from '../../utils/format-time';

export interface VideoPlaybackDialogData {
  readonly video: SavedVideo;
}

/**
 * CDK Dialog that plays back a saved recording. Owns the blob-URL lifecycle —
 * the URL is created in the constructor and revoked when the component is
 * destroyed, so no URL leaks between opens.
 *
 * @example
 * dialog.open<void, VideoPlaybackDialogData>(VideoPlaybackDialogComponent, {
 *   data: { video },
 *   autoFocus: 'first-tabbable',
 *   restoreFocus: true,
 *   ariaModal: true,
 * });
 */
@Component({
  selector: 'app-video-playback-dialog',
  templateUrl: './video-playback-dialog.component.html',
  styleUrl: './video-playback-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective],
  host: {
    class: 'dialog-panel dialog-panel--playback',
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': '$titleLabel()',
  },
})
export class VideoPlaybackDialogComponent {
  readonly data: VideoPlaybackDialogData = inject<VideoPlaybackDialogData>(DIALOG_DATA);
  readonly #dialogRef = inject<DialogRef<void>>(DialogRef);
  readonly #destroyRef = inject(DestroyRef);

  readonly $player = viewChild<ElementRef<HTMLVideoElement>>('player');

  readonly #$src = signal<string | null>(null);
  readonly $src = this.#$src.asReadonly();

  readonly #$isPlaying = signal<boolean>(false);
  readonly $isPlaying = this.#$isPlaying.asReadonly();

  readonly #$currentTime = signal<number>(0);
  readonly #$duration = signal<number>(this.data.video.duration);

  readonly $progress = computed<number>(() => {
    const duration = this.#$duration();
    return duration > 0 ? (this.#$currentTime() / duration) * 100 : 0;
  });

  readonly $titleLabel = computed<string>(
    () => `Playback — ${formatRecordedAt(this.data.video.recordedAt)}`,
  );

  readonly $currentLabel = computed<string>(() => formatTime(this.#$currentTime()));
  readonly $durationLabel = computed<string>(() => formatTime(this.#$duration()));

  #rafId: number | null = null;

  constructor() {
    const url = URL.createObjectURL(this.data.video.blob);
    this.#$src.set(url);
    this.#destroyRef.onDestroy(() => {
      URL.revokeObjectURL(url);
      this.#stopRaf();
    });
  }

  onLoadedMetadata(): void {
    const player = this.$player()?.nativeElement;
    // Chunked WebM from MediaRecorder can report Infinity until a seek-to-EoF
    // forces re-parse; fall back to the recorded duration so the scrubber and
    // duration label stay accurate.
    if (!player || !Number.isFinite(player.duration)) return;
    this.#$duration.set(player.duration);
  }

  onTimeUpdate(): void {
    const player = this.$player()?.nativeElement;
    if (!player) return;
    this.#$currentTime.set(player.currentTime);
  }

  onPlay(): void {
    this.#$isPlaying.set(true);
    this.#startRaf();
  }

  onPause(): void {
    this.#$isPlaying.set(false);
    this.#stopRaf();
  }

  togglePlayback(): void {
    const player = this.$player()?.nativeElement;
    if (!player) return;
    if (player.paused) {
      void player.play();
    } else {
      player.pause();
    }
  }

  onScrub(event: Event): void {
    const player = this.$player()?.nativeElement;
    const duration = this.#$duration();
    if (!player || duration === 0 || !(event.target instanceof HTMLInputElement)) return;
    const ratio = Number(event.target.value) / 100;
    player.currentTime = ratio * duration;
  }

  close(): void {
    this.#dialogRef.close();
  }

  // rAF loop drives the scrubber's `currentTime` at display framerate — the
  // native `timeupdate` event fires at ~4–16 Hz, which reads as stepped motion.
  readonly #tick = (): void => {
    const player = this.$player()?.nativeElement;
    if (!player) return;
    this.#$currentTime.set(player.currentTime);
    this.#rafId = requestAnimationFrame(this.#tick);
  };

  #startRaf(): void {
    if (this.#rafId !== null) return;
    this.#rafId = requestAnimationFrame(this.#tick);
  }

  #stopRaf(): void {
    if (this.#rafId === null) return;
    cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
  }
}
