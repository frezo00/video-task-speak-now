# Manual testing

Step-by-step procedures for reproducing behaviors that can't be exercised from a Vitest run — either because they depend on real browser APIs, real throttling, or both. Unit coverage for the same logic lives beside each source file as `*.spec.ts`; this document only covers the flows that need a live browser.

Append a new section per phase as new manually-verified behavior lands.

---

## Phase 3 — bandwidth detection & quality selection

[`BandwidthService`](../src/app/core/bandwidth/services/bandwidth.service.ts) reads `navigator.connection.downlink` first and only falls back to a timed download against `https://speed.cloudflare.com/__down?bytes=500000` when the API is unavailable or returns a non-positive value.

On Chromium desktops `navigator.connection.downlink` is always a positive number, so the Cloudflare fallback never runs by default. DevTools **Network → Throttling** does **not** change `navigator.connection.downlink` — it only throttles outgoing HTTP. To exercise the throttling-based test cases we need to force the fallback path.

### Force the fallback path

Temporarily add this `<script>` to [`src/index.html`](../src/index.html) inside `<head>` (do **not** commit):

```html
<script>
  Object.defineProperty(Navigator.prototype, 'connection', {
    value: undefined,
    configurable: true,
  });
</script>
```

This runs before Angular bootstraps, shadows the native `connection` getter on the prototype, and makes `navigator.connection` evaluate to `undefined`. `BandwidthService.#readNetworkInformation()` then returns `null` and `measure()` falls through to the 3-sample Cloudflare probe — which **is** affected by DevTools throttling and URL blocking.

Equivalent DevTools-only alternative (no file edit): Sources → Overrides → save `index.html` for overrides → add the same `<script>` to the saved copy → reload. Use this when you don't want a dirty working tree.

Revert by deleting the script (or reverting `src/index.html`) before committing.

### Test matrix

Run `npm start`, open DevTools, keep the script in `index.html`, then for each row: apply the DevTools setup, reload, and confirm the expected result.

| #   | DevTools setup                                                                                                                                                         | Expected result                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Throttling **No throttling**, no URL block                                                                                                                             | Preview opens at **1080p** (camera-permitting). Real downlink > 5 Mbps via the three averaged Cloudflare probes.                                                                        |
| 2   | Throttling **Custom: 3000 kb/s down, 750 kb/s up, 40 ms latency**                                                                                                      | Preview opens at **720p**. Probes land in the 2–5 Mbps band.                                                                                                                            |
| 3   | Throttling **Slow 3G** (built-in preset)                                                                                                                               | 150 ms spinner, then preview opens at **360p**. Probes land below 2 Mbps.                                                                                                               |
| 4   | No throttling, **block `speed.cloudflare.com/__down*`** (right-click a probe request → Block request URL, or add the pattern in More tools → Network request blocking) | 150 ms spinner, all 3 probes show `(blocked:devtools)`, preview opens at **720p**, banner reads _"Couldn't measure bandwidth — defaulting to Medium. You can change it from settings."_ |

Notes:

- With **Slow 3G**, probe time approaches the per-sample 8 s timeout ([`BANDWIDTH_PROBE_TIMEOUT_MS`](../src/app/core/bandwidth/models/bandwidth.constants.ts)). If any probe times out, you'll land on the failure banner (row 4) instead of 360p (row 3) — that's the designed boundary behavior, not a bug.
- Filter the Network tab by `cloudflare` to make the three probe requests easy to spot and right-click.
- Tier thresholds (`< 2 → low`, `2–5 → medium`, `> 5 → high`) live in [`BandwidthService.mapToQuality`](../src/app/core/bandwidth/services/bandwidth.service.ts).

### Quality override menu

Does not require the `navigator.connection` override.

- Click the gear → menu opens above-right of the gear with three rows; the current tier shows a green check.
- **X / Esc / outside click** each close the menu and return focus to the gear.
- Selecting a different tier swaps the preview within ~500 ms; the check moves to the new row on next open.
- After a manual selection, a subsequent re-measurement does not override the user's choice (`QualityState` tracks `manuallyOverridden`).
- **Tab** cycles within the menu (CDK focus trap).

### A11y smoke

- VoiceOver / NVDA announces the spinner as _"Loading"_, the menu as _"Recording quality, menu, 3 items"_, and each row as e.g. _"720p Medium Quality, checked"_.

---

## Phase 4 — Recording

The recorder pill in [`RecorderControlsComponent`](../src/app/features/recorder/components/recorder-controls/recorder-controls.component.ts) morphs between two visual modes based on `RecorderState.status`. `RecorderService.start(stream)` at [`core/recorder/`](../src/app/core/recorder/services/recorder.service.ts) wraps `MediaRecorder` with a 10 s `setTimeout` hard cap (constant [`RECORDING_HARD_CAP_MS`](../src/app/core/recorder/models/recorder.constants.ts)). Recordings are held in memory only — persistence lands in Phase 5.

### Test matrix

Run `npm start`, allow camera access, wait for preview at the auto-detected quality.

| #   | Action                                                                               | Expected result                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Click the red record button                                                          | Pill morphs: blue stop button on left, progress bar advancing, timer advancing `0.0 s → 0.1 s → …`. Gear button becomes disabled. `RecorderState.status` is `'recording'`.                                               |
| 2   | Wait 10 seconds (do not click stop)                                                  | Hard cap fires at ~`10.0 s`: progress reaches 100 %, pill reverts to idle (red circle). New entry appears in `VideosState.items` (inspect via Redux DevTools: `store.snapshot().videos.items`). Timer resets to `0.0 s`. |
| 3   | Start a recording, click the blue stop button at ~`3 s`                              | Pill reverts immediately to idle. `VideosState.items` has one entry with `duration ≈ 3.0`. No banner.                                                                                                                    |
| 4   | Record twice in a row                                                                | `VideosState.items.length === 2`, newest first (ordered by prepend; `recordedAt` desc).                                                                                                                                  |
| 5   | Hide the tab during a recording, show it again after ~`5 s`                          | Progress visual jumps forward (RAF pauses while hidden). Real recording continues — wall-clock is authoritative, hard cap still fires at true 10 s.                                                                      |
| 6   | Keyboard: Tab to the record button, press Space                                      | Recording starts. Space on the morphed stop button stops the recording. Focus stays on the button through the visual morph.                                                                                              |
| 7   | Refresh the page mid-recording                                                       | State resets to idle; list is empty. Expected — no persistence until Phase 5.                                                                                                                                            |
| 8   | Click the gear icon while recording                                                  | Button is disabled and does not open the menu. Prevents stream restart mid-record.                                                                                                                                       |
| 9   | Block `MediaRecorder` globally (DevTools console: `delete MediaRecorder`) and reload | On clicking record, the promise rejects (`unsupported-mime-type` or `ReferenceError`); `RecorderState` resets to idle and an error banner shows _"Recording failed. Try again."_ (Recovery via reload.)                  |

### Verifying the sidebar list

The sidebar UI that consumes `VideosState.items` lands in Phase 6. For Phase 4, verify the state directly via Redux DevTools (install the extension, reload, check the `videos` slice) or temporarily add `{{ store.selectSnapshot('videos') | json }}` to a component template during local testing.

### Codec / MIME type selection

On Chromium the service picks `video/webm;codecs=vp9` (first in [`PREFERRED_MIME_TYPES`](../src/app/core/recorder/models/recorder.constants.ts)). Safari, which doesn't support VP9 in `MediaRecorder`, falls back to `video/webm` or `video/mp4`. The chosen type is stored on `SavedVideo.mimeType` for Phase 5 to feed `<source type>` at playback.

### A11y smoke

- The progress bar has `role="progressbar"` with `aria-valuemin/max/now`. The visual timer (`.X s`) is `aria-hidden="true"`; a sibling `cdk-visually-hidden` span carries `aria-live="polite"` with an integer-second announcement (`0 seconds`, `1 seconds`, …) that fires once per second via a `Math.floor(elapsed / 1000)` computed signal.
- Focus traversal reaches the record button; the morphed stop button retains focus when the pill changes so Space continues to work.

---

## Phase 5 — Persistence

[`VideoStorageService`](../src/app/core/storage/services/video-storage.service.ts) backs `VideosState` via Dexie (DB name [`VIDEOS_DB_NAME`](../src/app/core/storage/db/videos-db.ts) = `video-task-speak-now`, one table `videos` keyed by `id` with a secondary index on `recordedAt`). Write-through happens inside `VideosState.onRecordingCompleted` — the state slice only prepends after Dexie resolves. Hydration on boot runs inside `provideAppInitializer` in [`app.config.ts`](../src/app/app.config.ts) and dispatches `Videos.Hydrated` once.

### Test matrix

Run `npm start`, allow camera access, wait for preview.

| #   | Action                                                                                                                                                                                                                                             | Expected result                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Record → stop at ~3 s                                                                                                                                                                                                                              | `VideosState.items` gets one entry (inspect via Redux DevTools, sidebar UI lands in Phase 6). DevTools → Application → IndexedDB → `video-task-speak-now` → `videos` table shows one row with `id`, `blob`, `mimeType`, `duration ≈ 3.0`, `recordedAt`, `resolution`.                                                                                                                                          |
| 2   | Refresh the tab                                                                                                                                                                                                                                    | On reload, Redux DevTools shows exactly one `[Videos] Hydrated` action fired during boot with the persisted row. `videos.items.length === 1`; no `Recording.*` actions run.                                                                                                                                                                                                                                    |
| 3   | Record two more, then refresh                                                                                                                                                                                                                      | `Videos.Hydrated` payload has three items, ordered newest-first by `recordedAt`. No banners shown.                                                                                                                                                                                                                                                                                                             |
| 4   | DevTools → Application → Storage → Quota override → 1 MB; refresh; record → stop                                                                                                                                                                   | `Videos.SaveFailed` dispatches; red banner _"Storage is full — delete some saved videos and try again."_; `videos.items.length` unchanged; no row written to the `videos` table.                                                                                                                                                                                                                               |
| 5   | Firefox Strict private window (IndexedDB blocked): reload                                                                                                                                                                                          | Red banner _"Your browser is blocking storage. Recordings won't be saved."_ surfaces on boot via the `provideAppInitializer` catch. Recording still works within the session; recording completion dispatches `Videos.SaveFailed` and shows the same blocked-storage banner (`StorageErrorKind.Unavailable` has fixed copy that applies to both contexts). Reload loses everything. Expected graceful degrade. |
| 6   | With app idle, run in DevTools console: `indexedDB.open('video-task-speak-now').onsuccess = e => { const tx = e.target.result.transaction('videos','readwrite'); tx.objectStore('videos').put({ id: 'bad', resolution: 'ultra' }); };` then reload | Info banner _"Some saved videos could not be loaded."_ shows once; valid rows still render. The row shaped as `{ id: 'bad', resolution: 'ultra' }` fails `isValidRow` and is counted into `skippedCount`. Hard-refresh to dismiss; the corrupt row is not auto-deleted.                                                                                                                                        |
| 7   | Record in Chromium vs. Safari                                                                                                                                                                                                                      | `SavedVideo.mimeType` reflects the codec the platform negotiated (`video/webm;codecs=vp9` on Chromium, `video/webm` or `video/mp4` on Safari). Stored verbatim for Phase 6 playback `<source type>`.                                                                                                                                                                                                           |
| 8   | Open two tabs, record in each, observe the other                                                                                                                                                                                                   | Dexie serializes writes across tabs; `Videos.Hydrated` in the _other_ tab on next refresh includes both rows. Concurrent writes do not corrupt the table.                                                                                                                                                                                                                                                      |

### Inspecting IndexedDB

`chrome://inspect` → Devtools → Application → Storage → IndexedDB → `video-task-speak-now` → `videos`. Entries show the `Blob` as `{ size, type }` plus the other fields. Deleting the database from this panel + reload is the manual reset.

### A11y smoke

- Banners from `ErrorBannerService` inherit the Phase 1–3 a11y posture (live region on the banner container; each push is announced once).
- Nothing new is focusable in Phase 5 — list / playback / delete UI lands in Phase 6.
