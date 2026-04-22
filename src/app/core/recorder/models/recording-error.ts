export const RecordingErrorKind = {
  AlreadyRecording: 'already-recording',
  NoStream: 'no-stream',
  MediaError: 'media-error',
  UnsupportedMimeType: 'unsupported-mime-type',
} as const satisfies Record<string, string>;
export type RecordingErrorKind = (typeof RecordingErrorKind)[keyof typeof RecordingErrorKind];

export class RecordingError extends Error {
  readonly kind: RecordingErrorKind;

  constructor(kind: RecordingErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RecordingError';
    this.kind = kind;
  }
}
