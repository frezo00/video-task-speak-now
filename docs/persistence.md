# Persistence

Deep-dive on how recorded videos are stored, loaded, and deleted.

---

## Why Dexie

`localStorage` caps at ~5–10 MB per origin and only handles strings — a single 10-second 1080p recording already blows past that, and encoding to base64 would inflate the size another ~33 %. IndexedDB is the only browser-native option that:

- stores **Blob** instances directly (no base64, no copy)
- scales to hundreds of MB without friction
- is fully async, preventing main-thread jank during saves

Dexie.js is the chosen wrapper because:

- TypeScript-first API; tables and records are typed end-to-end
- Clear schema migrations via `db.version(n).stores(...)`
- Supports reactive observables if future work wants them
- Tiny (~30 KB gzipped) and has no runtime dependencies

Alternatives considered:

| Library       | Reason not chosen                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Raw IndexedDB | Verbose request/event API, higher risk of version-upgrade bugs for a 5-day project.                            |
| `idb-keyval`  | Only key-value; awkward for listing + deleting by criteria.                                                    |
| `localForage` | Multi-backend abstraction adds layers we don't need — IndexedDB is always available in our supported browsers. |

---

## Schema

A single `videos` table:

```ts
interface SavedVideo {
  id: string; // UUID, client-generated with crypto.randomUUID()
  blob: Blob; // the raw MediaRecorder output
  mimeType: string; // e.g. 'video/webm;codecs=vp9' (platform-dependent)
  duration: number; // seconds (float, 1-decimal precision)
  recordedAt: Date; // ISO-serialized by Dexie as epoch ms
  resolution: '360p' | '720p' | '1080p';
}
```

Dexie schema declaration:

```ts
class VideosDB extends Dexie {
  videos!: Dexie.Table<SavedVideo, string>;
  constructor() {
    super('video-task-speak-now');
    this.version(1).stores({
      // primary key: id
      // secondary index: recordedAt (for sorted list queries)
      videos: 'id, recordedAt',
    });
  }
}
```

### Why these fields

- `id` — stable handle for deletion and React/Angular `trackBy`. UUID beats auto-increment because it lets us optimistically update state before Dexie confirms.
- `blob` — storing the raw `Blob` avoids transcoding. The browser returns it on read; we assign it straight to `<video src>` via `URL.createObjectURL`.
- `mimeType` — MediaRecorder chooses a codec based on platform (`video/webm` on Chromium, `video/mp4` on Safari). We persist so playback can set the right `<source type>`.
- `duration` — captured at stop time, displayed in the sidebar without having to read the blob.
- `recordedAt` — used for sort order (newest first) and the sidebar label `DD.MM.YYYY HH:mm`.
- `resolution` — not strictly needed for playback but useful for README screenshots and debugging.

### Why no thumbnail field

Thumbnails are generated on demand from the Blob in the component (`<video>` seeks to 0, paints to `<canvas>`, exports as data URL). Storing thumbnails would double the write cost without a clear win; we regenerate each time the list renders. If this turns out to be perceptibly slow with many videos, Phase 7 can revisit and cache them.

---

## Lifecycle

### 1. App boot — hydrate

An `APP_INITIALIZER` calls `VideoStorageService.listAll()` and dispatches `VideosHydrated(videos)`. The sidebar shows its loading skeleton until this resolves (usually < 50 ms for a handful of entries).

Rows that fail to load (corrupt schema, missing blob) are **skipped** — we log the error and continue. After hydration, if any rows were skipped, `ErrorBannerService` pushes an info-level notice.

### 2. Record → save

When `RecorderService` completes:

1. Resolve the `Blob` from `MediaRecorder.stop()`.
2. Dispatch `SaveRecording({ blob, mimeType, duration, resolution })`.
3. Reducer calls `VideoStorageService.save(...)` — awaits the Dexie insert.
4. On success → dispatch `VideoSaved(newRecord)`, which prepends it to `VideosState`.
5. On failure (quota exceeded, Dexie error) → `RecordingSaveFailed` → banner; Blob is discarded (no temp in-memory retention; user can re-record).

Save is **not optimistic** — we wait for Dexie to confirm before updating the sidebar. The save is fast enough that blocking for < 100 ms is imperceptible, and it removes the risk of a phantom entry if the write fails.

### 3. Delete

1. User clicks trash → confirmation dialog.
2. On confirm → dispatch `DeleteVideo(id)`.
3. Reducer calls `VideoStorageService.deleteById(id)` — awaits.
4. On success → dispatch `VideoDeleted(id)`, which removes it from state.
5. On failure → banner; state unchanged.

Same rationale for pessimistic updates: predictable behavior over speed.

---

## Quota & failure modes

- **Quota:** Chromium allows up to ~60 % of total disk per origin; Firefox and Safari enforce their own caps (typically ≥ 1 GB). Ample room for 10-second clips.
- **Quota-exceeded:** caught explicitly and surfaced as a banner: _"Storage is full — delete some saved videos and try again."_ The attempted Blob is discarded, not retained in memory.
- **Corrupt row:** a row failing schema validation during hydrate is skipped, logged, and counted. We do **not** auto-delete — the user might downgrade browsers / versions and want to recover later.
- **No IndexedDB (private mode in some browsers):** Dexie throws on open. `ErrorBannerService` pushes: _"Your browser is blocking storage. Recordings won't be saved."_ The app still lets the user record for the session — they just lose it on refresh. This degrades gracefully rather than hard-failing.
- **Multi-tab writes:** Dexie transactions handle concurrent writes from multiple tabs correctly. No extra coordination layer needed.

---

## Testing

- `VideoStorageService` unit tests run against **`fake-indexeddb`** so they don't touch real browser storage.
- Cases covered:
  - Save → list round-trip
  - Save → delete → list (empty)
  - List with one corrupt row (expect skip + warning)
  - Save failure (quota simulated by mocking `db.videos.add` to throw `QuotaExceededError`)
  - Hydrate ordering (newest first, verified by `recordedAt` index)

See `src/app/core/storage/video-storage.service.spec.ts` from Phase 5 onward.
