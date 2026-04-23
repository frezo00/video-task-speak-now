import type { VideoResolution } from '@core/storage';

export namespace Recording {
  export class Started {
    static readonly type = '[Recording] Started';
  }

  export class StopRequested {
    static readonly type = '[Recording] Stop Requested';
  }

  export class Completed {
    static readonly type = '[Recording] Completed';
    constructor(
      readonly blob: Blob,
      readonly duration: number,
      readonly mimeType: string,
      readonly resolution: VideoResolution,
    ) {}
  }

  export class Failed {
    static readonly type = '[Recording] Failed';
    constructor(readonly error: unknown) {}
  }
}
