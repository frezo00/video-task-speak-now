# Task breakdown — phase-based roadmap

Work is organized into **7 phases**, each scoped to a meaningful feature. Every phase ends with the app in a **functional, demoable state** — you can stop at any phase boundary and still have something coherent to show. Total: ~25 commits.

| Phase | Scope | End state |
|---|---|---|
| 0 | Project documentation | Repo readable; reviewer understands plan. |
| 1 | Scaffold & app shell | `npm start` renders the static layout. |
| 2 | Camera preview & permissions | Live webcam feed visible; permission errors shown. |
| 3 | Bandwidth detection & quality selection | Resolution adapts on load; user can override; failures fall back to Medium. |
| 4 | Recording | Record → Blob in memory; auto-stop at 10 s. |
| 5 | Persistence | Recordings survive refresh. |
| 6 | Saved videos UI | List, play, delete — all Figma screens reproduced. |
| 7 | Polish & submission | Responsive, a11y, screenshots, README final. |

Phases 1–6 are non-negotiable. Phase 7 can be trimmed to screenshots + README if time is tight.

---

## Phase 0 — Project documentation

| # | Commit | Acceptance |
|---|---|---|
| 0.1 | `docs: initial project documentation and task breakdown` | README + /docs renders. |

---

## Phase 1 — Scaffold & app shell

| # | Commit | Acceptance |
|---|---|---|
| 1.1 | `chore: scaffold Angular 21 app (standalone, zoneless, SCSS, Vitest)` | `ng new` output committed; `npm start` serves `http://localhost:4200`. |
| 1.2 | `chore: install NGXS 21, Angular CDK, Dexie, Angular ESLint, Prettier` | Dependencies in `package.json`; `npm ci` succeeds. |
| 1.3 | `chore: strict TS config + lint/format scripts` | `npm run lint` + `npm run format:check` pass on empty project; `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true` in `tsconfig.json`. |
| 1.4 | `feat(layout): base app shell — recorder main area + empty right sidebar` | Static markup matching Figma screen 02 (empty state); SCSS variables + global tokens in place. |

**End state:** `npm start` opens the app at the Figma idle layout (no camera, no recording, empty sidebar).

---

## Phase 2 — Camera preview & permissions

| # | Commit | Acceptance |
|---|---|---|
| 2.1 | `feat(camera): getUserMedia preview at 720p default` | Live webcam visible in `<video>` element; mirrored horizontally per Figma. |
| 2.2 | `feat(camera): permission-denied error dialog via CDK Dialog` | Deny permission → dialog opens with remediation text; closing the dialog keeps recorder hidden. |

**End state:** App shows live webcam feed at 720p. Permission denial shows a clear recoverable error.

---

## Phase 3 — Bandwidth detection & quality selection

| # | Commit | Acceptance |
|---|---|---|
| 3.1 | `feat(state): NGXS BandwidthState + QualityState with selectors` | Empty reducers + selectors; initial state `{ status: 'idle' }`. |
| 3.2 | `feat(bandwidth): Network Information API primary path` | `navigator.connection.downlink` read where available, emitted into state. |
| 3.3 | `feat(bandwidth): timed-download fallback (500 KB CDN asset, 3 samples averaged)` | When Network Info API is missing, download a known asset 3× and average; emit Mbps. |
| 3.4 | `feat(bandwidth): APP_INITIALIZER → measure → map to quality → apply to camera constraints` | On app boot, measure → map → open camera at resolved quality. Spinner shown during measurement (Figma screen 01). |
| 3.5 | `feat(settings): quality override dropdown using CDK Overlay (Figma 03)` | Gear icon opens overlay with Low/Med/High; checkmark on selected; picking one restarts the camera stream at the new resolution. |
| 3.6 | `feat(bandwidth): ErrorBannerService — bandwidth failure defaults to Medium + notifies user` | Simulated bandwidth failure (e.g., offline CDN fetch) results in Medium + banner. |
| 3.7 | `test(bandwidth): Vitest coverage for service + state` | Unit tests: measure() happy path, fallback path, failure → Medium; state reducers for each action. |

**End state:** On load, app measures bandwidth, applies the right resolution, user can override; failures fall back to Medium with a visible notice.

---

## Phase 4 — Recording

| # | Commit | Acceptance |
|---|---|---|
| 4.1 | `feat(state): VideosState skeleton + recording state machine (idle → recording → stopped)` | Actions: StartRecording, StopRecording, RecordingCompleted, RecordingFailed. |
| 4.2 | `feat(recorder): MediaRecorder integration with 10-second hard cap` | `RecorderService.start(stream)` returns a Promise<Blob>; hard cap fires at 10s via `setTimeout`. |
| 4.3 | `feat(recorder): start/stop controls with progress bar and timer (Figma 04)` | Pill mutates per Figma: idle shows red circle; recording shows stop square + progress + `x.y s` timer. |
| 4.4 | `test(recorder): unit coverage for recording state transitions` | Tests for start → auto-stop at 10s, start → manual stop, start → MediaRecorder error. |

**End state:** Record button captures a Blob; 10 s hard cap enforced; stop-early works. Blob held in memory only — persistence is Phase 5.

---

## Phase 5 — Persistence

| # | Commit | Acceptance |
|---|---|---|
| 5.1 | `feat(storage): VideoStorageService with Dexie (save / list / delete)` | `save(blob, meta)`, `listAll()`, `deleteById(id)`; all async, all Promise-based. |
| 5.2 | `feat(storage): APP_INITIALIZER loads persisted videos into VideosState` | On boot, `listAll()` → dispatch `VideosHydrated`. Corrupt rows logged + skipped. |
| 5.3 | `feat(recorder): on stop, save Blob → Dexie → VideosState` | Write-through: recorder completion dispatches `SaveRecording` which hits Dexie then emits `VideoSaved`. |
| 5.4 | `test(storage): unit coverage for service + state` | Fake-indexeddb tests: save+list+delete round-trip; hydrate with corrupt row; quota-exceeded path. |

**End state:** Every recording persists. Refresh the tab → videos are still there.

---

## Phase 6 — Saved videos UI (list, playback, delete)

| # | Commit | Acceptance |
|---|---|---|
| 6.1 | `feat(videos): saved videos list on right sidebar — thumbnails, date, duration (Figma 05)` | Each item shows first-frame thumbnail (extracted via `<video>` + `<canvas>`), `DD.MM.YYYY HH:mm`, and duration. |
| 6.2 | `feat(videos): playback modal with scrubber, pause/play (Figma 06)` | Click thumbnail → CDK Dialog opens with video element and a scrubber; ESC closes; focus returns to thumbnail. |
| 6.3 | `feat(videos): delete confirmation modal with CDK focus-trap (Figma 07)` | Trash icon → confirmation dialog; Cancel closes; Delete dispatches `DeleteVideo` action that cascades to Dexie + state. |

**End state:** Full CRUD against saved videos — list, play, delete. All Figma screens reproduced.

---

## Phase 7 — Polish & submission

| # | Commit | Acceptance |
|---|---|---|
| 7.1 | `style: responsive breakpoints (mobile / tablet / desktop)` | Sidebar collapses to bottom drawer on < 768 px; recorder controls stay tappable on mobile. |
| 7.2 | `chore: a11y pass — focus traps on modals, aria-live on timer, keyboard navigation` | Axe DevTools: zero critical issues on main page + each modal. |
| 7.3 | `chore: add key-state screenshots to /screenshots/` | 7 screenshots matching Figma states in `/screenshots/`, referenced from README. |
| 7.4 | `docs: README final — setup, persistence rationale, screenshots, assumptions, challenges` | README's Assumptions section + Screenshots section populated. |
| 7.5 | `chore: final lint + test + production build sweep` | `npm run lint && npm test && npm run build` all succeed clean. |

**End state:** Ready to submit.

---

## Scope guardrails

- **Do not** add server-side pieces, user accounts, sharing, editing, or PWA features.
- **Do not** swap Dexie / NGXS / CDK / Vitest / Angular version without re-confirming with the project owner — they are locked decisions, see [`architecture.md`](architecture.md#2-decision-log).
- Each commit should leave the app **buildable** (`npm run build` succeeds). Phase boundaries must leave it **functional** (not just compilable).
- Any deviation from a planned commit in this file: update this file **in the same commit** that introduces the change.
