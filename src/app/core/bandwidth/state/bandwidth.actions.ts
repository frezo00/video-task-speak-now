import type { BandwidthError } from '../models/bandwidth-error';
import type { QualityTier } from '../models/quality-profile';

export namespace Bandwidth {
  export class MeasurementRequested {
    static readonly type = '[Bandwidth] Measurement Requested';
  }

  export class MeasurementCompleted {
    static readonly type = '[Bandwidth] Measurement Completed';
    constructor(
      readonly mbps: number,
      readonly quality: QualityTier,
    ) {}
  }

  export class MeasurementFailed {
    static readonly type = '[Bandwidth] Measurement Failed';
    constructor(readonly error: BandwidthError) {}
  }
}
