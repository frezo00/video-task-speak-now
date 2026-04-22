export const CAMERA_STATUSES = [
  'idle',
  'opening',
  'live',
  'error',
] as const satisfies readonly string[];
export type CameraStatus = (typeof CAMERA_STATUSES)[number];
