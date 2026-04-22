export const BANDWIDTH_STATUSES = [
  'idle',
  'measuring',
  'ready',
  'failed',
] as const satisfies readonly string[];
export type BandwidthStatus = (typeof BANDWIDTH_STATUSES)[number];
