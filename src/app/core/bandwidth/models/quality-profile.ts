export const QUALITY_TIERS = ['low', 'medium', 'high'] as const satisfies readonly string[];
export type QualityTier = (typeof QUALITY_TIERS)[number];

export interface QualityProfile {
  readonly tier: QualityTier;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

export const QUALITY_PROFILES = {
  low: {
    tier: 'low',
    width: 640,
    height: 360,
    label: '360p (Low Quality)',
  },
  medium: {
    tier: 'medium',
    width: 1280,
    height: 720,
    label: '720p (Medium Quality)',
  },
  high: {
    tier: 'high',
    width: 1920,
    height: 1080,
    label: '1080p (High Quality)',
  },
} as const satisfies Record<QualityTier, QualityProfile>;

export function constraintsFor(tier: QualityTier): MediaStreamConstraints {
  const profile = QUALITY_PROFILES[tier];
  return {
    video: {
      width: { ideal: profile.width },
      height: { ideal: profile.height },
      frameRate: { ideal: 30 },
    },
    audio: false,
  };
}
