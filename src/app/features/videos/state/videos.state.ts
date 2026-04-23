import { inject, Injectable } from '@angular/core';
import { Action, Selector, State, type StateContext, Store } from '@ngxs/store';
import { ErrorBannerService } from '@core/error';
import { Recording } from '@core/recorder';
import { storageErrorMessage, VideoStorageService, type SavedVideo } from '@core/storage';
import { Videos } from './videos.actions';

export interface VideosStateModel {
  readonly items: readonly SavedVideo[];
}

const HYDRATION_SKIPPED_MESSAGE = 'Some saved videos could not be loaded.';
const DELETE_UNKNOWN_FALLBACK = "Couldn't delete the video.";

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

  @Action(Videos.Hydrated)
  onHydrated(ctx: StateContext<VideosStateModel>, action: Videos.Hydrated): void {
    ctx.patchState({ items: action.items });
    if (action.skippedCount > 0) {
      this.#banner.push({ level: 'info', message: HYDRATION_SKIPPED_MESSAGE });
    }
  }

  @Action(Videos.SaveFailed)
  onSaveFailed(_ctx: StateContext<VideosStateModel>, action: Videos.SaveFailed): void {
    this.#banner.push({ level: 'error', message: storageErrorMessage(action.error) });
    console.error('[videos] save failed', action.error);
  }

  @Action(Videos.DeleteRequested)
  async onDeleteRequested(
    ctx: StateContext<VideosStateModel>,
    action: Videos.DeleteRequested,
  ): Promise<void> {
    // Dexie's delete is idempotent — it resolves cleanly when the row is already
    // gone (e.g. a concurrent tab removed it). Leave state in the "filtered"
    // end-state; do not add a "row not found" error path.
    try {
      await this.#storage.deleteById(action.id);
    } catch (err) {
      this.#store.dispatch(new Videos.DeleteFailed(action.id, err));
      return;
    }
    ctx.patchState({ items: ctx.getState().items.filter((item) => item.id !== action.id) });
    this.#store.dispatch(new Videos.Deleted(action.id));
  }

  @Action(Videos.DeleteFailed)
  onDeleteFailed(_ctx: StateContext<VideosStateModel>, action: Videos.DeleteFailed): void {
    this.#banner.push({
      level: 'error',
      message: storageErrorMessage(action.error, DELETE_UNKNOWN_FALLBACK),
    });
    console.error('[videos] delete failed', action.id, action.error);
  }
}
