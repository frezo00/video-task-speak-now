import {
  ChangeDetectionStrategy,
  Component,
  effect,
  type ElementRef,
  input,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-video-preview',
  templateUrl: './video-preview.component.html',
  styleUrl: './video-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'video-preview',
    '[class.video-preview--empty]': '!$stream()',
    'aria-label': 'Live camera preview',
  },
})
export class VideoPreviewComponent {
  readonly $stream = input<MediaStream | null>(null, { alias: 'stream' });
  readonly $videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');

  constructor() {
    effect(() => {
      const el = this.$videoEl().nativeElement;
      const stream = this.$stream();
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
    });
  }
}
