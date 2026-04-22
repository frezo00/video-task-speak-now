import type { BandwidthError } from '../models/bandwidth-error';
import type { QualityTier } from '../models/quality-profile';

export namespace Bandwidth {
  export class MeasurementRequested {
    static readonly type = '[Bandwidth] Measurement Requested';
  }

  export class MeasurementCompleted {
    static readonly type = '[Bandwidth] Measurement Completed';
    constructor(
      public readonly mbps: number,
      public readonly quality: QualityTier,
    ) {}
  }

  export class MeasurementFailed {
    static readonly type = '[Bandwidth] Measurement Failed';
    constructor(public readonly error: BandwidthError) {}
  }
}
