# Bandwidth Check + Web Camera Quality Selector

Angular responsive web app that measures the user's bandwidth, adapts webcam recording quality accordingly, records short clips (≤ 10 s), and persists them in the browser across refresh.

> **Status:** All seven phases complete. See [`docs/task-breakdown.md`](docs/task-breakdown.md) for the merge history and [`docs/manual-testing.md`](docs/manual-testing.md) for the QA matrices.

---

## Stack

| Area                | Choice                                                         | Why                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Angular 21.2.x**                                             | Latest — zoneless change detection, standalone-by-default components, signals-first, Vitest as default test runner.                                       |
| State management    | **NGXS 21.x**                                                  | Required by the brief. Small boilerplate compared to NgRx, pairs well with signals.                                                                       |
| Styling             | **Plain SCSS + Angular CDK**                                   | Custom Figma design — plain SCSS gives pixel fidelity; CDK supplies Overlay / Dialog / FocusTrap / Portal primitives without Material's opinionated look. |
| Persistence         | **Dexie.js** over IndexedDB                                    | Best DX for large Blob storage; `localStorage` cannot hold video blobs at scale. Deep-dive in [`docs/persistence.md`](docs/persistence.md).               |
| Bandwidth detection | Hybrid — **Network Information API** + timed-download fallback | `navigator.connection.downlink` isn't available in Safari/iOS; a timed download of a known-size CDN asset fills the gap.                                  |
| Testing             | **Vitest** — unit coverage for services + NGXS state           | Angular 21's new default test runner. Component + E2E deferred to scope-permitting.                                                                       |

---

## Quick start

```sh
nvm use               # Node 22 (see .nvmrc)
npm ci                # clean install
npm start             # http://localhost:4200
npm test              # Vitest single run (via ng test → @angular/build:unit-test)
npm run build         # production bundle in /dist
```

Quality gates (also run on pre-commit via Husky + lint-staged on staged files only):

```sh
npm run lint          # Angular + typescript-eslint
npm run lint:fix      # auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check (CI-friendly)
npm run stylelint     # SCSS lint
npm run stylelint:fix # auto-fix
npm run typecheck     # tsc -b --noEmit across the solution references
```

Conventional Commits are enforced via `commitlint` on every `git commit`.

---

## Features

From the [assignment brief](docs/assignment.md):

- **Bandwidth check on load** — measure user bandwidth, map to quality tier
  - Low (< 2 Mbps) → 360p
  - Medium (2–5 Mbps) → 720p
  - High (> 5 Mbps) → 1080p
  - Bandwidth detection failure → default to Medium and notify the user
- **Manual quality override** — user can force Low / Medium / High
- **Video recording** — max 10 s, stoppable earlier
- **Saved videos panel (right side)** — list with date + duration, play, delete
- **Persistence** — all recordings survive tab refresh / reopen
- **Error handling** — graceful UI for webcam permission denial and bandwidth failures

---

## Docs index

- [`docs/assignment.md`](docs/assignment.md) — clean transcription of the brief
- [`docs/architecture.md`](docs/architecture.md) — layers, decision log, module boundaries, a11y posture
- [`docs/conventions.md`](docs/conventions.md) — TypeScript, Angular, NGXS, SCSS coding conventions
- [`docs/task-breakdown.md`](docs/task-breakdown.md) — phase-based PR roadmap
- [`docs/design-notes.md`](docs/design-notes.md) — per-Figma-screen descriptions + UI tokens
- [`docs/persistence.md`](docs/persistence.md) — Dexie schema, IndexedDB strategy, edge cases
- [`docs/manual-testing.md`](docs/manual-testing.md) — browser-only QA procedures (bandwidth throttling / URL blocking)

---

## Persistence approach (summary)

Video blobs live in **IndexedDB** via Dexie. On app init, an `APP_INITIALIZER` hydrates the `VideosState` from Dexie so the right-panel list is populated before the user sees the UI. Recording → save flow is write-through: when `MediaRecorder` stops, the Blob is persisted to Dexie in the same action that updates NGXS. Deletes are cascaded across both stores. Full rationale and schema in [`docs/persistence.md`](docs/persistence.md).

---

## Assumptions & known gaps

- **HTTPS or localhost required** for `getUserMedia`. Over plain HTTP (except `localhost`) the camera permission prompt is suppressed by the browser and the app cannot open a preview stream.
- **Per-origin storage.** IndexedDB is scoped to the browser profile + origin. Clips are not synced across browsers, devices, or incognito sessions — matches the brief's "persist across refresh" requirement without overreach.
- **Bandwidth fallback endpoint.** When `navigator.connection.downlink` is unavailable (Safari / iOS), the service falls back to a timed 500 KB download from `speed.cloudflare.com`. If that host ever changes URL, the constant in `src/app/core/bandwidth/services/bandwidth.service.ts` needs updating.
- **MIME type persistence is verbatim.** Chromium typically negotiates `video/webm;codecs=vp9,opus`, Safari `video/mp4;codecs=avc1.42E01E,mp4a.40.2`. The recorder stores the exact mime returned by `MediaRecorder` so playback later can pass it to the `<source>` element unchanged.
- **10 s hard cap is wall-clock RAF-driven.** If the tab is hidden mid-recording, the `requestAnimationFrame` loop throttles and the UI timer can lag real time; a `setTimeout` fallback enforces the 10 s cap regardless, so the clip length is bounded even when the tab is backgrounded.
- **Thumbnails are not cached.** The first frame is extracted from the Blob on list render via an off-screen `<video>` + `<canvas>`. With the 10 s clip cap the measured cost is negligible in realistic session sizes; see [`docs/persistence.md`](docs/persistence.md) for the measurement that justifies deferring a schema-v2 cache.
- **No E2E / component tests.** Per [`CLAUDE.md`](CLAUDE.md), v1 test scope is services + NGXS state reducers only. Component specs and E2E (which require `getUserMedia` mocking in a real browser) are deferred.

---

## Screenshots

Captured at 1440 × 900 desktop viewport, and at 393 × 852 for the mobile drawer shot.

| #   | State                     | Image                                                    |
| --- | ------------------------- | -------------------------------------------------------- |
| 01  | Bandwidth check (spinner) | ![Bandwidth check](./screenshots/01-bandwidth-check.png) |
| 02  | Idle recorder             | ![Idle recorder](./screenshots/02-idle-recorder.png)     |
| 03  | Quality menu open         | ![Quality menu](./screenshots/03-quality-menu.png)       |
| 04  | Recording in progress     | ![Recording](./screenshots/04-recording.png)             |
| 05  | Populated videos list     | ![Populated list](./screenshots/05-populated-list.png)   |
| 06  | Playback dialog           | ![Playback dialog](./screenshots/06-playback-dialog.png) |
| 07  | Delete confirmation       | ![Delete confirm](./screenshots/07-delete-confirm.png)   |
| 08  | Mobile bottom drawer      | ![Mobile drawer](./screenshots/08-mobile-drawer.png)     |

---

## Challenges & notes

- **Zoneless + MediaRecorder event plumbing.** Angular 21's zoneless scheduler means MediaRecorder's `dataavailable` / `stop` events don't auto-trigger change detection. The recorder service bridges by writing signals inside event handlers, which the OnPush components then pick up reactively without needing a manual `cdr.markForCheck()` anywhere.
- **Safari thumbnail extraction.** The off-screen `<video>` used by `extractFirstFrame` is detached from the DOM — Safari refuses to paint frames from a detached `<video>` to a canvas unless the element is inserted, sized ≥ 1 × 1, and `muted` before `play()`. The utility applies those exact conditions; the workaround is documented inline.
- **Bandwidth API browser drift.** `navigator.connection` is Chromium-only and even there is reported-rounded (25 Mbps is the stated ceiling). The fallback path is the primary measurement on Safari; on Chromium it's treated as a confirmation check when the API reports suspiciously low or obviously-capped values.
- **iOS Safari permission UX.** Even when camera access is granted, iOS Safari requires a direct user gesture to call `getUserMedia` — we gate the call on the bandwidth measurement completion (which is a user-initiated boot flow) to stay inside that gesture window.
- **10 s hard cap under tab throttling.** RAF-driven progress gives smooth UI updates when the tab is visible, but throttles aggressively when hidden. A parallel `setTimeout(RECORDING_HARD_CAP_MS)` fires the stop regardless, so the cap holds even on a backgrounded tab; the UI catches up on the next visibility change.

---

## License

Private — not intended for redistribution.
