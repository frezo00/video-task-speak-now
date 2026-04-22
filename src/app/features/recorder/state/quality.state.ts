import { Injectable } from '@angular/core';
import { Action, Selector, State, type StateContext } from '@ngxs/store';
import {
  Bandwidth,
  BANDWIDTH_FALLBACK_TIER,
  QUALITY_PROFILES,
  type QualityProfile,
  type QualityTier,
} from '@core/bandwidth';
import { Quality } from './quality.actions';

export const QUALITY_SOURCES = ['auto', 'manual'] as const satisfies readonly string[];
export type QualitySource = (typeof QUALITY_SOURCES)[number];

export interface QualityStateModel {
  readonly tier: QualityTier;
  readonly source: QualitySource;
}

@State<QualityStateModel>({
  name: 'quality',
  defaults: { tier: BANDWIDTH_FALLBACK_TIER, source: 'auto' },
})
@Injectable()
export class QualityState {
  @Selector()
  static tier(state: QualityStateModel): QualityTier {
    return state.tier;
  }

  @Selector()
  static source(state: QualityStateModel): QualitySource {
    return state.source;
  }

  @Selector()
  static profile(state: QualityStateModel): QualityProfile {
    return QUALITY_PROFILES[state.tier];
  }

  @Action(Bandwidth.MeasurementCompleted)
  applyAuto(ctx: StateContext<QualityStateModel>, action: Bandwidth.MeasurementCompleted): void {
    if (ctx.getState().source === 'manual') {
      return;
    }
    ctx.patchState({ tier: action.quality, source: 'auto' });
  }

  @Action(Bandwidth.MeasurementFailed)
  applyFallback(ctx: StateContext<QualityStateModel>): void {
    if (ctx.getState().source === 'manual') {
      return;
    }
    ctx.patchState({ tier: BANDWIDTH_FALLBACK_TIER, source: 'auto' });
  }

  @Action(Quality.ManuallyOverridden)
  override(ctx: StateContext<QualityStateModel>, action: Quality.ManuallyOverridden): void {
    ctx.patchState({ tier: action.tier, source: 'manual' });
  }

  @Action(Quality.OverrideRolledBack)
  rollBack(ctx: StateContext<QualityStateModel>, action: Quality.OverrideRolledBack): void {
    ctx.patchState({ tier: action.toTier, source: 'manual' });
  }
}
