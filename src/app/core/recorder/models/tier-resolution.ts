import type { QualityTier } from '@core/bandwidth';
import type { VideoResolution } from '@core/storage';

export const TIER_TO_RESOLUTION = {
  low: '360p',
  medium: '720p',
  high: '1080p',
} as const satisfies Record<QualityTier, VideoResolution>;
