export const RECORDER_STATUSES = [
  'idle',
  'recording',
  'stopping',
] as const satisfies readonly string[];
export type RecorderStatus = (typeof RECORDER_STATUSES)[number];
