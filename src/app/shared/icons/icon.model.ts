export const ICONS = [
  'check',
  'close',
  'exclamation',
  'pause',
  'play',
  'settings',
  'trash',
  'video',
] as const satisfies readonly string[];

export type Icon = (typeof ICONS)[number];

export const ICON_SIZES = ['small', 'medium', 'large'] as const satisfies readonly string[];

export type IconSize = (typeof ICON_SIZES)[number];
