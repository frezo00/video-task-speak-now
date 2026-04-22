export const RECORDING_HARD_CAP_MS = 10_000;

export const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
] as const satisfies readonly string[];
