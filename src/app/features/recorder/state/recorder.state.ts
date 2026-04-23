import { inject, Injectable } from '@angular/core';
import { Action, Selector, State, type StateContext, Store } from '@ngxs/store';
import { CameraService } from '@core/camera';
import { ErrorBannerService } from '@core/error';
import {
  Recording,
  RecorderService,
  RecordingError,
  RecordingErrorKind,
  RECORDING_HARD_CAP_MS,
  TIER_TO_RESOLUTION,
  type RecorderStatus,
} from '@core/recorder';
import { QualityState } from './quality.state';

export interface RecorderStateModel {
  readonly status: RecorderStatus;
  readonly startedAt: number | null;
}

const RECORDING_FAILURE_MESSAGE = 'Recording failed. Try again.';

@State<RecorderStateModel>({
  name: 'recorder',
  defaults: { status: 'idle', startedAt: null },
})
@Injectable()
export class RecorderState {
  readonly #recorder = inject(RecorderService);
  readonly #camera = inject(CameraService);
  readonly #banner = inject(ErrorBannerService);
  readonly #store = inject(Store);

  @Selector()
  static status(state: RecorderStateModel): RecorderStatus {
    return state.status;
  }

  @Selector()
  static startedAt(state: RecorderStateModel): number | null {
    return state.startedAt;
  }

  @Action(Recording.Started)
  async onStarted(ctx: StateContext<RecorderStateModel>): Promise<void> {
    if (ctx.getState().status !== 'idle') {
      return;
    }
    const stream = this.#camera.$stream();
    if (!stream) {
      this.#store.dispatch(
        new Recording.Failed(
          new RecordingError(RecordingErrorKind.NoStream, 'Camera stream is not ready'),
        ),
      );
      return;
    }
    const startedAt = performance.now();
    ctx.patchState({ status: 'recording', startedAt });
    try {
      const { blob, mimeType } = await this.#recorder.start(stream);
      const elapsed = Math.min(performance.now() - startedAt, RECORDING_HARD_CAP_MS);
      const duration = Math.round(elapsed / 100) / 10;
      const tier = this.#store.selectSnapshot(QualityState.tier);
      const resolution = TIER_TO_RESOLUTION[tier];
      this.#store.dispatch(new Recording.Completed(blob, duration, mimeType, resolution));
    } catch (err) {
      this.#store.dispatch(new Recording.Failed(err));
    }
  }

  @Action(Recording.StopRequested)
  onStopRequested(ctx: StateContext<RecorderStateModel>): void {
    if (ctx.getState().status !== 'recording') {
      return;
    }
    ctx.patchState({ status: 'stopping' });
    this.#recorder.stop();
  }

  @Action(Recording.Completed)
  onCompleted(ctx: StateContext<RecorderStateModel>): void {
    ctx.patchState({ status: 'idle', startedAt: null });
  }

  @Action(Recording.Failed)
  onFailed(ctx: StateContext<RecorderStateModel>, action: Recording.Failed): void {
    ctx.patchState({ status: 'idle', startedAt: null });
    this.#banner.push({ level: 'error', message: RECORDING_FAILURE_MESSAGE });
    console.error('[recording]', action.error);
  }
}
