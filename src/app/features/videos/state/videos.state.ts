import { inject, Injectable } from '@angular/core';
import { Action, Selector, State, type StateContext, Store } from '@ngxs/store';
import { ErrorBannerService } from '@core/error';
import { Recording } from '@core/recorder';
import { storageErrorMessage, VideoStorageService, type SavedVideo } from '@core/storage';
import { Videos } from './videos.actions';

export interface VideosStateModel {
  readonly items: readonly SavedVideo[];
}

@State<VideosStateModel>({
  name: 'videos',
  defaults: { items: [] },
})
@Injectable()
export class VideosState {
  readonly #storage = inject(VideoStorageService);
  readonly #banner = inject(ErrorBannerService);
  readonly #store = inject(Store);

  @Selector()
  static items(state: VideosStateModel): readonly SavedVideo[] {
    return state.items;
  }

  @Action(Recording.Completed)
  async onRecordingCompleted(
    ctx: StateContext<VideosStateModel>,
    action: Recording.Completed,
  ): Promise<void> {
    const record: SavedVideo = {
      id: crypto.randomUUID(),
      blob: action.blob,
      mimeType: action.mimeType,
      duration: action.duration,
      resolution: action.resolution,
      recordedAt: new Date(),
    };
    try {
      await this.#storage.save(record);
    } catch (err) {
      this.#store.dispatch(new Videos.SaveFailed(err));
      return;
    }
    ctx.patchState({ items: [record, ...ctx.getState().items] });
    this.#store.dispatch(new Videos.Saved(record));
  }

  @Action(Videos.SaveFailed)
  onSaveFailed(_ctx: StateContext<VideosStateModel>, action: Videos.SaveFailed): void {
    this.#banner.push({ level: 'error', message: storageErrorMessage(action.error) });
    console.error('[videos] save failed', action.error);
  }
}
