import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { SavedVideo } from '@core/storage';
import { IconDirective } from '@shared/icons';
import { formatDuration } from '../../utils/format-duration';
import { formatRecordedAt } from '../../utils/format-recorded-at';
import { VideoThumbnailComponent } from '../video-thumbnail/video-thumbnail.component';

@Component({
  selector: 'app-videos-list-item',
  templateUrl: './videos-list-item.component.html',
  styleUrl: './videos-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective, VideoThumbnailComponent],
  host: {
    class: 'videos-list-item',
    tabindex: '0',
    role: 'button',
    '[attr.aria-label]': '$playAriaLabel()',
    '(click)': 'requestPlay()',
    '(keydown.enter)': 'onKeyboardPlay($event)',
    '(keydown.space)': 'onKeyboardPlay($event)',
  },
})
export class VideosListItemComponent {
  readonly $video = input.required<SavedVideo>({ alias: 'video' });
  readonly $playRequested = output<SavedVideo>({ alias: 'playRequested' });
  readonly $deleteRequested = output<SavedVideo>({ alias: 'deleteRequested' });

  readonly $dateLabel = computed<string>(() => formatRecordedAt(this.$video().recordedAt));
  readonly $durationLabel = computed<string>(() => formatDuration(this.$video().duration));
  readonly $playAriaLabel = computed<string>(() => `Play recording from ${this.$dateLabel()}`);
  readonly $deleteAriaLabel = computed<string>(() => `Delete recording from ${this.$dateLabel()}`);

  requestPlay(): void {
    this.$playRequested.emit(this.$video());
  }

  onKeyboardPlay(event: Event): void {
    event.preventDefault();
    this.requestPlay();
  }

  onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.$deleteRequested.emit(this.$video());
  }
}
