# Bandwidth Check + Web Camera Quality Selector

Angular responsive web app that measures the user's bandwidth, adapts webcam recording quality accordingly, records short clips (≤ 10 s), and persists them in the browser across refresh.

> **Status:** Phase 1 tooling baseline in place — Angular 21 scaffold, Prettier + ESLint, Stylelint, Husky + lint-staged + commitlint, strict TypeScript, written conventions. Feature work starts with the shared icon module — see [`docs/task-breakdown.md`](docs/task-breakdown.md) for the roadmap.

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

---

## Persistence approach (summary)

Video blobs live in **IndexedDB** via Dexie. On app init, an `APP_INITIALIZER` hydrates the `VideosState` from Dexie so the right-panel list is populated before the user sees the UI. Recording → save flow is write-through: when `MediaRecorder` stops, the Blob is persisted to Dexie in the same action that updates NGXS. Deletes are cascaded across both stores. Full rationale and schema in [`docs/persistence.md`](docs/persistence.md).

---

## Assumptions & known gaps

Running list — appended as each phase surfaces new decisions. Empty until Phase 1 begins.

- _(none yet)_

---

## Screenshots

> Populated in Phase 7. Each key state captured: initial bandwidth check, idle recorder, recording in progress, quality override, saved list, playback modal, delete confirmation.

---

## License

Private — not intended for redistribution.
