import Dexie, { type EntityTable } from 'dexie';
import type { SavedVideo } from '../models/saved-video';

export const VIDEOS_DB_NAME = 'video-task-speak-now';

export class VideosDB extends Dexie {
  readonly videos!: EntityTable<SavedVideo, 'id'>;

  constructor() {
    super(VIDEOS_DB_NAME);
    this.version(1).stores({ videos: 'id, recordedAt' });
  }
}
