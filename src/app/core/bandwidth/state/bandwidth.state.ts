import { inject, Injectable } from '@angular/core';
import { Action, State, type StateContext, Store, Selector } from '@ngxs/store';
import { ErrorBannerService } from '@core/error';
import { BandwidthError, BandwidthErrorKind } from '../models/bandwidth-error';
import type { BandwidthStatus } from '../models/bandwidth-status';
import { BandwidthService } from '../services/bandwidth.service';
import { Bandwidth } from './bandwidth.actions';

export interface BandwidthStateModel {
  readonly mbps: number | null;
  readonly status: BandwidthStatus;
  readonly errorKind: BandwidthErrorKind | null;
}

const BANDWIDTH_FAILURE_MESSAGE =
  "Couldn't measure bandwidth — defaulting to Medium. You can change it from settings.";

@State<BandwidthStateModel>({
  name: 'bandwidth',
  defaults: { mbps: null, status: 'idle', errorKind: null },
})
@Injectable()
export class BandwidthState {
  readonly #service = inject(BandwidthService);
  readonly #store = inject(Store);
  readonly #banner = inject(ErrorBannerService);

  @Selector()
  static status(state: BandwidthStateModel): BandwidthStatus {
    return state.status;
  }

  @Selector()
  static mbps(state: BandwidthStateModel): number | null {
    return state.mbps;
  }

  @Selector()
  static errorKind(state: BandwidthStateModel): BandwidthErrorKind | null {
    return state.errorKind;
  }

  @Action(Bandwidth.MeasurementRequested)
  async measure(ctx: StateContext<BandwidthStateModel>): Promise<void> {
    ctx.patchState({ status: 'measuring', errorKind: null });
    try {
      const mbps = await this.#service.measure();
      const quality = this.#service.mapToQuality(mbps);
      ctx.patchState({ status: 'ready', mbps });
      this.#store.dispatch(new Bandwidth.MeasurementCompleted(mbps, quality));
    } catch (err) {
      const error =
        err instanceof BandwidthError
          ? err
          : new BandwidthError(BandwidthErrorKind.ProbeFailed, 'Unexpected measurement failure', {
              cause: err,
            });
      ctx.patchState({ status: 'failed', errorKind: error.kind });
      this.#banner.push({ level: 'warning', message: BANDWIDTH_FAILURE_MESSAGE });
      this.#store.dispatch(new Bandwidth.MeasurementFailed(error));
    }
  }
}
