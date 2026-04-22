export const CameraErrorKind = {
  PermissionDenied: 'permission-denied',
  DeviceNotFound: 'device-not-found',
  Overconstrained: 'overconstrained',
  InUse: 'in-use',
  Unknown: 'unknown',
} as const satisfies Record<string, string>;
export type CameraErrorKind = (typeof CameraErrorKind)[keyof typeof CameraErrorKind];

export class CameraError extends Error {
  readonly kind: CameraErrorKind;

  constructor(kind: CameraErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CameraError';
    this.kind = kind;
  }
}
