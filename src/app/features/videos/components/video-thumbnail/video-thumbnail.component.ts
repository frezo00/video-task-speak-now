import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
  type Signal,
} from '@angular/core';
import { IconDirective } from '@shared/icons';
import { extractFirstFrame } from '../../utils/extract-first-frame';

type ThumbnailState = 'loading' | 'ready' | 'failed';

// Cache first-frame data URLs by blob identity so hydration (every card mounts
// at once) only decodes each video once, and re-renders of the same SavedVideo
// skip the canvas work entirely. WeakMap lets the entries get collected with
// their blobs after a card is destroyed/deleted.
const THUMBNAIL_CACHE = new WeakMap<Blob, string>();

@Component({
  selector: 'app-video-thumbnail',
  templateUrl: './video-thumbnail.component.html',
  styleUrl: './video-thumbnail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective],
  host: {
    class: 'video-thumbnail',
    '[attr.data-state]': '$state()',
  },
})
export class VideoThumbnailComponent {
  readonly $blob = input.required<Blob>({ alias: 'blob' });
  readonly $alt = input<string>('', { alias: 'alt' });

  readonly #$state = signal<ThumbnailState>('loading');
  readonly #$dataUrl = signal<string | null>(null);

  readonly $state: Signal<ThumbnailState> = this.#$state.asReadonly();
  readonly $dataUrl: Signal<string | null> = this.#$dataUrl.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const blob = this.$blob();
      const cached = THUMBNAIL_CACHE.get(blob);
      if (cached !== undefined) {
        this.#$dataUrl.set(cached);
        this.#$state.set('ready');
        return;
      }

      const controller = new AbortController();
      this.#$state.set('loading');
      this.#$dataUrl.set(null);

      extractFirstFrame(blob, controller.signal)
        .then((frame) => {
          if (controller.signal.aborted) return;
          THUMBNAIL_CACHE.set(blob, frame.dataUrl);
          this.#$dataUrl.set(frame.dataUrl);
          this.#$state.set('ready');
        })
        .catch((err: unknown) => {
          if (isAbortError(err)) return;
          this.#$state.set('failed');
        });

      onCleanup(() => controller.abort());
    });
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
