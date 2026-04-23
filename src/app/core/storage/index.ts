export { VIDEO_RESOLUTIONS } from './models/saved-video';
export type { SavedVideo, VideoResolution } from './models/saved-video';
export { StorageError, StorageErrorKind } from './models/storage-error';
export { VIDEOS_DB_NAME, VideosDB } from './db/videos-db';
export { VideoStorageService, VIDEOS_DB, mapDexieError } from './services/video-storage.service';
export type { ListAllResult } from './services/video-storage.service';
