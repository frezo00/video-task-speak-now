import type { SavedVideo } from '@core/storage';

export namespace Videos {
  export class Hydrated {
    static readonly type = '[Videos] Hydrated';
    constructor(
      readonly items: readonly SavedVideo[],
      readonly skippedCount: number,
    ) {}
  }

  export class Saved {
    static readonly type = '[Videos] Saved';
    constructor(readonly record: SavedVideo) {}
  }

  export class SaveFailed {
    static readonly type = '[Videos] Save Failed';
    constructor(readonly error: unknown) {}
  }
}
