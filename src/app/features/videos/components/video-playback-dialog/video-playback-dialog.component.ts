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
    '[attr.aria-labelledby]': 'titleId',
  },
})
export class VideoPlaybackDialogComponent {
  readonly data: VideoPlaybackDialogData = inject<VideoPlaybackDialogData>(DIALOG_DATA);
  readonly titleId = `playback-dialog-title-${crypto.randomUUID()}`;
  readonly #dialogRef = inject<DialogRef<void>>(DialogRef);
  readonly #destroyRef = inject(DestroyRef);

  readonly $player = viewChild<ElementRef<HTMLVideoElement>>('player');

  readonly #$src = signal<string | null>(null);
  readonly $src = this.#$src.asReadonly();

  readonly #$isPlaying = signal<boolean>(false);
  readonly $isPlaying = this.#$isPlaying.asReadonly();

  readonly #$currentTime = signal<number>(0);
  readonly #$duration = signal<number>(0);

  readonly $progress = computed<number>(() => {
    const duration = this.#$duration();
    return duration > 0 ? (this.#$currentTime() / duration) * 100 : 0;
  });

  readonly $titleLabel = computed<string>(
    () => `Playback — ${formatRecordedAt(this.data.video.recordedAt)}`,
  );

  constructor() {
    const url = URL.createObjectURL(this.data.video.blob);
    this.#$src.set(url);
    this.#destroyRef.onDestroy(() => URL.revokeObjectURL(url));
  }

  onLoadedMetadata(event: Event): void {
    const target = event.target as HTMLVideoElement;
    this.#$duration.set(target.duration);
  }

  onTimeUpdate(event: Event): void {
    const target = event.target as HTMLVideoElement;
    this.#$currentTime.set(target.currentTime);
  }

  onPlay(): void {
    this.#$isPlaying.set(true);
  }

  onPause(): void {
    this.#$isPlaying.set(false);
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
    const target = event.target as HTMLInputElement;
    const player = this.$player()?.nativeElement;
    if (!player || this.#$duration() === 0) return;
    const ratio = Number(target.value) / 100;
    player.currentTime = ratio * this.#$duration();
  }

  close(): void {
    this.#dialogRef.close();
  }
}
