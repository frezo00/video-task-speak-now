export const BandwidthErrorKind = {
  NetworkApiUnavailable: 'network-api-unavailable',
  ProbeFailed: 'probe-failed',
  ProbeTimedOut: 'probe-timed-out',
} as const satisfies Record<string, string>;
export type BandwidthErrorKind = (typeof BandwidthErrorKind)[keyof typeof BandwidthErrorKind];

export class BandwidthError extends Error {
  readonly kind: BandwidthErrorKind;

  constructor(kind: BandwidthErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BandwidthError';
    this.kind = kind;
  }
}
