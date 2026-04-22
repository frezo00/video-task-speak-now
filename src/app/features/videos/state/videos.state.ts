import { Injectable } from '@angular/core';
import { Action, Selector, State, type StateContext } from '@ngxs/store';
import { Recording } from '@core/recorder';
import type { SavedVideo } from '@core/storage';

export interface VideosStateModel {
  readonly items: readonly SavedVideo[];
}

@State<VideosStateModel>({
  name: 'videos',
  defaults: { items: [] },
})
@Injectable()
export class VideosState {
  @Selector()
  static items(state: VideosStateModel): readonly SavedVideo[] {
    return state.items;
  }

  @Action(Recording.Completed)
  onRecordingCompleted(ctx: StateContext<VideosStateModel>, action: Recording.Completed): void {
    const saved: SavedVideo = {
      id: crypto.randomUUID(),
      blob: action.blob,
      mimeType: action.mimeType,
      duration: action.duration,
      resolution: action.resolution,
      recordedAt: new Date(),
    };
    ctx.patchState({ items: [saved, ...ctx.getState().items] });
  }
}
