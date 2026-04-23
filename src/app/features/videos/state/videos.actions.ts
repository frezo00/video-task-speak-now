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

  export class DeleteRequested {
    static readonly type = '[Videos] Delete Requested';
    constructor(readonly id: string) {}
  }

  export class Deleted {
    static readonly type = '[Videos] Deleted';
    constructor(readonly id: string) {}
  }

  export class DeleteFailed {
    static readonly type = '[Videos] Delete Failed';
    constructor(
      readonly id: string,
      readonly error: unknown,
    ) {}
  }
}
