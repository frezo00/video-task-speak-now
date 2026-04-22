# Task breakdown — phase-based roadmap

Work is organized into **7 phases**, each scoped to a meaningful feature. Every phase ends with the app in a **functional, demoable state** — you can stop at any phase boundary and still have something coherent to show. Roughly one PR per phase.

| Phase | Scope                                   | End state                                                                   |
| ----- | --------------------------------------- | --------------------------------------------------------------------------- |
| 0     | Project documentation                   | Repo readable; reviewer understands plan.                                   |
| 1     | Scaffold & app shell                    | `npm start` renders the static layout.                                      |
| 2     | Camera preview & permissions            | Live webcam feed visible; permission errors shown.                          |
| 3     | Bandwidth detection & quality selection | Resolution adapts on load; user can override; failures fall back to Medium. |
| 4     | Recording                               | Record → Blob in memory; auto-stop at 10 s.                                 |
| 5     | Persistence                             | Recordings survive refresh.                                                 |
| 6     | Saved videos UI                         | List, play, delete — all Figma screens reproduced.                          |
| 7     | Polish & submission                     | Responsive, a11y, screenshots, README final.                                |

Phases 1–6 are non-negotiable. Phase 7 can be trimmed to screenshots + README if time is tight.

Each phase ships as one squash-merged PR (see [`architecture.md` §2 row 8](architecture.md#2-decision-log)). Rows below are updated when a PR opens; scope changes are recorded in the same PR that introduces them.

---

## Phase 0 — Project documentation

Committed directly to `main` before the PR workflow started.

| PR         | Summary                                                                                  | Status |
| ---------- | ---------------------------------------------------------------------------------------- | ------ |
| _(pre-PR)_ | `docs: initial project documentation and task breakdown` — README + `/docs/` scaffolded. | Done   |

---

## Phase 1 — Scaffold, tooling & conventions

Expanded from the original four-commit sketch to split each tooling concern into its own commit, add a written conventions document, wire a CI workflow, and ship a type-safe icon-font module.

| PR                                                                                                                              | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [#1](https://github.com/frezo00/video-task-speak-now/pull/1) — phase-1: tooling baseline, conventions, CI, icons, and app shell | Angular 21 zoneless scaffold with OnPush schematics; Prettier + ESLint + Stylelint encoding project TS/Angular/SCSS conventions (flat ESLint config, `no-restricted-syntax` against `enum` and TS `private`); husky + lint-staged + commitlint; strict TS (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); written conventions in `docs/conventions.md`; GitHub Actions PR verification (lint → format:check → stylelint → typecheck → build → test:ci), Node pinned via `.nvmrc`; type-safe `[appIcon]` directive backed by inline base64 icomoon font; design tokens as CSS custom properties + SCSS aliases; Lato via Google Fonts with system fallback; static app shell matching Figma screen 02. | Merged |

**End state:** `npm start` opens the app at the Figma idle layout (no camera, no recording, empty sidebar). From this PR onward, every commit passes through the pre-commit hook (lint-staged + commitlint).

---

## Phase 2 — Camera preview & permissions

| PR                                                                                                            | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [#2](https://github.com/frezo00/video-task-speak-now/pull/2) — phase-2: camera preview and permission dialogs | `getUserMedia` preview at 720p default (mirrored via CSS on `<video>`); `CameraService` in `core/camera/` with signals-first lifecycle, typed `CameraError` classification, and 9-case Vitest spec; permission-denied and device-not-found routed through a shared `ConfirmDialogComponent` in `shared/confirm-dialog/` with Retry back into the boot flow; Nx-style feature-library layout (`pages/` + `components/` + `models/` + `services/` + `utils/`) with `@app`/`@core`/`@features`/`@shared` TypeScript path aliases; `docs/architecture.md` §3 and `docs/conventions.md` §1.9 updated to match. | Merged |

**End state:** App shows live webcam feed at 720p. Permission denial shows a clear recoverable error.

---

## Phase 3 — Bandwidth detection & quality selection

Largest phase by scope — shipped as one PR with two commits.

| PR                                                                | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `phase-3/bandwidth-and-quality` — auto-quality on boot + override | NGXS `BandwidthState` + `QualityState` with selectors; Network Information API primary path + timed-download fallback (500 KB CDN asset, 3 samples averaged); `RecorderPageComponent` measures on init → maps to quality → applies to camera constraints, with a 150 ms debounced spinner during measurement (Figma screen 01); bandwidth failure defaults to Medium with an `ErrorBannerService` warning. CDK Overlay menu anchored to the gear button with Low / Med / High and a checkmark on the active tier (Figma screen 03); picking a tier dispatches `Quality.ManuallyOverridden` and restarts the stream; on `Overconstrained` we roll back to the prior tier with a banner. Manual selection sticks across re-measurements. Vitest covers both state slices. | In review |

**End state:** On load the app measures bandwidth, applies the right resolution, user can override; failures fall back to Medium with a visible notice.

---

## Phase 4 — Recording

| PR                                              | Summary                                                                                                                                                                                                                                                                                                                                                                              | Status  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `phase-4/recording` — record with 10 s hard cap | `VideosState` skeleton + recording state machine (idle → recording → stopped) with `StartRecording` / `StopRecording` / `RecordingCompleted` / `RecordingFailed` actions; `RecorderService.start(stream)` returns `Promise<Blob>` with a 10 s `setTimeout` hard cap; start/stop controls with progress bar + `x.y s` timer (Figma screen 04); Vitest coverage for state transitions. | Planned |

**End state:** Record button captures a Blob; 10 s hard cap enforced; stop-early works. Blob held in memory only — persistence is Phase 5.

---

## Phase 5 — Persistence

| PR                                                 | Summary                                                                                                                                                                                                                                                                                                                                                      | Status  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `phase-5/persistence` — Dexie-backed video storage | `VideoStorageService` with Dexie — `save(blob, meta)`, `listAll()`, `deleteById(id)`, all Promise-based; `APP_INITIALIZER` hydrates `VideosState` from Dexie on boot with corrupt-row skip + log; write-through on recording stop (`SaveRecording` → Dexie → `VideoSaved`); fake-indexeddb tests covering round-trip, corrupt row, and quota-exceeded paths. | Planned |

**End state:** Every recording persists. Refresh the tab → videos are still there.

---

## Phase 6 — Saved videos UI (list, playback, delete)

| PR                                                 | Summary                                                                                                                                                                                                                                                                                                                                                                          | Status  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `phase-6/saved-videos-ui` — list, playback, delete | Right-sidebar list with first-frame thumbnail (extracted via `<video>` + `<canvas>`), `DD.MM.YYYY HH:mm`, and duration (Figma screen 05); playback modal via CDK Dialog with scrubber + pause/play, ESC closes with focus return (Figma screen 06); delete confirmation modal with CDK focus-trap, Delete dispatches `DeleteVideo` cascading to Dexie + state (Figma screen 07). | Planned |

**End state:** Full CRUD against saved videos — list, play, delete. All Figma screens reproduced.

---

## Phase 7 — Polish & submission

| PR                                                | Summary                                                                                                                                                                                                                                                                                                                                                                  | Status  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `phase-7/polish` — responsive, a11y, final README | Responsive breakpoints (sidebar → bottom drawer < 768 px; tappable controls on mobile); a11y pass (focus traps on modals, `aria-live` on timer, keyboard nav, Axe zero critical); 7 key-state screenshots in `/screenshots/` referenced from README; README final (assumptions, persistence rationale, screenshots, challenges); final `lint && test:ci && build` sweep. | Planned |

**End state:** Ready to submit.

---

## Scope guardrails

- **Do not** add server-side pieces, user accounts, sharing, editing, or PWA features.
- **Do not** swap Dexie / NGXS / CDK / Vitest / Angular version without re-confirming with the project owner — they are locked decisions, see [`architecture.md`](architecture.md#2-decision-log).
- Each commit should leave the app **buildable** (`npm run build` succeeds). Phase boundaries must leave it **functional** (not just compilable).
- If a PR's scope drifts from what's listed above, update this file **in the same PR** that introduces the change.
