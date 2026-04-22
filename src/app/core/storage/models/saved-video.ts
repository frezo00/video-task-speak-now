export const VIDEO_RESOLUTIONS = ['360p', '720p', '1080p'] as const satisfies readonly string[];
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

export interface SavedVideo {
  readonly id: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly duration: number;
  readonly recordedAt: Date;
  readonly resolution: VideoResolution;
}
