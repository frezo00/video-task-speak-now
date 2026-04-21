export const ICONS = [
  'close',
  'pause',
  'play',
  'settings',
  'trash',
  'video',
] as const satisfies readonly string[];

export type Icon = (typeof ICONS)[number];

export const ICON_SIZES = [
  'xsmall',
  'small',
  'medium',
  'large',
  'xlarge',
] as const satisfies readonly string[];

export type IconSize = (typeof ICON_SIZES)[number];
