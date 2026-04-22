import type { QualityTier } from '@core/bandwidth';

export const OverrideRollbackReason = {
  Overconstrained: 'overconstrained',
} as const satisfies Record<string, string>;
export type OverrideRollbackReason =
  (typeof OverrideRollbackReason)[keyof typeof OverrideRollbackReason];

export namespace Quality {
  export class AutoApplied {
    static readonly type = '[Quality] Auto Applied';
    constructor(readonly tier: QualityTier) {}
  }

  export class ManuallyOverridden {
    static readonly type = '[Quality] Manually Overridden';
    constructor(readonly tier: QualityTier) {}
  }

  export class OverrideRolledBack {
    static readonly type = '[Quality] Override Rolled Back';
    constructor(
      readonly toTier: QualityTier,
      readonly reason: OverrideRollbackReason,
    ) {}
  }
}
