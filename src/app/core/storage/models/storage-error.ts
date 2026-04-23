export const StorageErrorKind = {
  QuotaExceeded: 'quota-exceeded',
  Unavailable: 'unavailable',
  Unknown: 'unknown',
} as const satisfies Record<string, string>;
export type StorageErrorKind = (typeof StorageErrorKind)[keyof typeof StorageErrorKind];

export class StorageError extends Error {
  readonly kind: StorageErrorKind;

  constructor(kind: StorageErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
    this.kind = kind;
  }
}
