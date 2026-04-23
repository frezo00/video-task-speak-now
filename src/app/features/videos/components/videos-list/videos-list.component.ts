import { Dialog } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngxs/store';
import type { SavedVideo } from '@core/storage';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
  type DialogResult,
} from '@shared/confirm-dialog';
import { IconDirective } from '@shared/icons';
import { Videos } from '../../state/videos.actions';
import { VideosState } from '../../state/videos.state';
import {
  VideoPlaybackDialogComponent,
  type VideoPlaybackDialogData,
} from '../video-playback-dialog/video-playback-dialog.component';
import { VideosListItemComponent } from '../videos-list-item/videos-list-item.component';

@Component({
  selector: 'app-videos-list',
  templateUrl: './videos-list.component.html',
  styleUrl: './videos-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective, VideosListItemComponent],
  host: {
    class: 'videos-list',
    role: 'region',
    'aria-label': 'Saved videos',
    '[attr.data-empty]': '$videos().length === 0',
  },
})
export class VideosListComponent {
  readonly #store = inject(Store);
  readonly #dialog = inject(Dialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #injector = inject(Injector);

  readonly $videos = this.#store.selectSignal(VideosState.items);
  // Angular's viewChildren reflection rejects ES-private fields (NG1053), so
  // the binding is public. Not part of the component's external API — treat as
  // internal.
  readonly $itemRefs = viewChildren<VideosListItemComponent, ElementRef<HTMLElement>>(
    VideosListItemComponent,
    { read: ElementRef },
  );

  onPlay(video: SavedVideo): void {
    const ref = this.#dialog.open<void, VideoPlaybackDialogData>(VideoPlaybackDialogComponent, {
      data: { video },
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaModal: true,
      panelClass: 'cdk-overlay-playback',
      // Pin pane width so CDK's GlobalPositionStrategy can center it. Without
      // an explicit width the pane is shrink-to-fit and the <video>'s intrinsic
      // resolution can push it wider than the host's 100% cap — which breaks
      // the wrapper's justify-content: center.
      width: 'min(56rem, 100%)',
    });
    ref.closed.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe();
  }

  onDelete(video: SavedVideo): void {
    const ref = this.#dialog.open<DialogResult, ConfirmDialogData>(ConfirmDialogComponent, {
      data: {
        type: 'danger',
        icon: 'exclamation',
        title: 'Delete this video?',
        body: 'Are you sure you want to delete this video? This action cannot be undone.',
        confirmLabel: 'Delete',
        dismissLabel: 'Cancel',
      },
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaModal: true,
    });
    ref.closed.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((result) => {
      if (result === 'confirm') {
        const indexBefore = this.$videos().findIndex((v) => v.id === video.id);
        this.#store.dispatch(new Videos.DeleteRequested(video.id));
        // CDK's restoreFocus returns focus to the trash button, but that button
        // is gone once the delete resolves. Defer to the next render so the list
        // has re-projected, then focus the neighbor — otherwise focus lands on
        // <body> and keyboard users have to Tab back in.
        afterNextRender(() => this.#focusNeighbor(indexBefore), { injector: this.#injector });
      }
    });
  }

  #focusNeighbor(previousIndex: number): void {
    const refs = this.$itemRefs();
    if (refs.length === 0) return;
    const nextIndex = Math.min(previousIndex, refs.length - 1);
    refs[nextIndex]?.nativeElement.focus();
  }
}
