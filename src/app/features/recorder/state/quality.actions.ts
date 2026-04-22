import type { QualityTier } from '@core/bandwidth';

export namespace Quality {
  export class AutoApplied {
    static readonly type = '[Quality] Auto Applied';
    constructor(public readonly tier: QualityTier) {}
  }
}
