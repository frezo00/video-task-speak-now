# Task breakdown — phase-based roadmap

Work is organized into **7 phases**, each scoped to a meaningful feature. Every phase ends with the app in a **functional, demoable state** — you can stop at any phase boundary and still have something coherent to show. Total: ~25 commits.

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

---

## Phase 0 — Project documentation

| #   | Commit                                                   | Acceptance              |
| --- | -------------------------------------------------------- | ----------------------- |
| 0.1 | `docs: initial project documentation and task breakdown` | README + /docs renders. |

---

## Phase 1 — Scaffold, tooling & conventions

Originally scoped to four commits (scaffold → deps → strict TS → app shell). Expanded to split each tooling concern into its own commit, introduce a written conventions document, wire a CI workflow, and add a type-safe icon-font module. The icon module and app-shell layout are the last remaining items in the phase.

| #    | Commit                                                                      | Status  | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | --------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | `chore: scaffold Angular 21 workspace with zoneless, SCSS, OnPush defaults` | done    | `ng new` output committed; `provideZonelessChangeDetection` wired; `angular.json` schematics default to OnPush + non-inline template/style + test generation; `AppComponent` uses OnPush and the `$title` signal prefix (`signal<string>(...)` with explicit generic); `npm run build` + `npm start` green.                                                                                                                                                                                                                                                                                                                  |
| 1.2  | `chore: install Prettier + ESLint with project conventions enforced`        | done    | `ng add @angular-eslint/schematics@21` + `prettier` + `eslint-config-prettier`. Flat `eslint.config.js` enforces: no enums, explicit return types, prefer-readonly, TS `private` banned (use ECMAScript `#`), OnPush, inject(), signals-first, template control flow, selector hygiene, and the classic `Component` / `Directive` class-suffix rules.                                                                                                                                                                                                                                                                        |
| 1.3  | `chore: install Stylelint with SCSS conventions`                            | done    | `.stylelintrc.json` with BEM-lite class pattern, `max-nesting-depth: 3`, kebab-case tokens, no `!important`, `no-empty-source` disabled so scaffolded component `.scss` files don't trip the scan.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.4  | `chore: enforce on commit — husky + lint-staged + commitlint`               | done    | `.husky/pre-commit` runs `lint-staged`; `.husky/commit-msg` runs `commitlint`. Staged `.ts/.html` → eslint + prettier; `.scss` → stylelint + prettier; others → prettier. Commit messages validated against Conventional Commits types called out in `CLAUDE.md`.                                                                                                                                                                                                                                                                                                                                                            |
| 1.5  | `chore: strict typescript config + typecheck script`                        | done    | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useDefineForClassFields` on top of the scaffold's `--strict` defaults. `npm run typecheck` wraps `tsc --noEmit -p tsconfig.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.6  | `docs(conventions): typescript + angular conventions`                       | done    | New `docs/conventions.md` covering TS, Angular v21+, NGXS, shared-code TSDoc, utility extraction, testing scope. Includes the `readonly #x` vs `private readonly _x` investigation table (recommends `#`).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1.7  | `docs(conventions): scss best practices`                                    | done    | SCSS section added to `docs/conventions.md` — file organization, `@use`-only, tokens not literals, BEM-lite, `:host` scoping, logical properties, breakpoint mixins, motion guard, a11y, no `!important`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.8  | `docs: link conventions + update task-breakdown`                            | done    | `CLAUDE.md` gains a "House rules" TL;DR and a navigation link to `docs/conventions.md`. `README.md` Quick start shows all tooling scripts. This file updated to reflect the expanded Phase 1.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.9  | `ci: add github actions workflow for PR verification`                       | done    | `.github/workflows/ci.yml` runs on PRs to `main` + pushes to `main`: `npm ci` → lint → format:check → stylelint → typecheck → build → `npm test`. Single `verify` job on `ubuntu-latest`, Node pinned via `.nvmrc`, npm cache via `actions/setup-node@v4`, in-progress runs cancelled on re-push. Runs before any feature work merges.                                                                                                                                                                                                                                                                                       |
| 1.10 | `feat(icons): type-safe [appIcon] directive backed by icomoon font`         | pending | Icon-font module at `src/app/shared/icons/` — typed `ICONS` + `IconSize`, `[appIcon]` directive with `$`-prefixed aliased inputs, icomoon-generated CSS with base64-inlined font, `icomoon-selection.json` kept for regeneration. Base `.icon` and `.icon--{size}` rules in `src/styles/_icons.scss`. `icomoon.css` wired via `angular.json` styles; `_icons.scss` via `src/styles.scss`. `eslint.config.js` gets `@angular-eslint/no-input-rename: 'off'` + `naming-convention` exemption for `objectLiteralProperty` — both required by the alias pattern (conventions §2.5). Icomoon outputs listed in `.prettierignore`. |
| 1.11 | `feat(layout): base app shell — recorder main area + empty right sidebar`   | pending | Static markup matching Figma screen 02 (empty state); SCSS tokens in `src/styles/_tokens.scss` wired via `src/styles.scss`; `host` metadata carries layout classes per [conventions §2.10 and §8.5](conventions.md).                                                                                                                                                                                                                                                                                                                                                                                                         |

**End state:** `npm start` opens the app at the Figma idle layout (no camera, no recording, empty sidebar). Every commit since 1.4 has gone through the pre-commit hook.

---

## Phase 2 — Camera preview & permissions

| #   | Commit                                                        | Acceptance                                                                                      |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2.1 | `feat(camera): getUserMedia preview at 720p default`          | Live webcam visible in `<video>` element; mirrored horizontally per Figma.                      |
| 2.2 | `feat(camera): permission-denied error dialog via CDK Dialog` | Deny permission → dialog opens with remediation text; closing the dialog keeps recorder hidden. |

**End state:** App shows live webcam feed at 720p. Permission denial shows a clear recoverable error.

---

## Phase 3 — Bandwidth detection & quality selection

| #   | Commit                                                                                       | Acceptance                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `feat(state): NGXS BandwidthState + QualityState with selectors`                             | Empty reducers + selectors; initial state `{ status: 'idle' }`.                                                                 |
| 3.2 | `feat(bandwidth): Network Information API primary path`                                      | `navigator.connection.downlink` read where available, emitted into state.                                                       |
| 3.3 | `feat(bandwidth): timed-download fallback (500 KB CDN asset, 3 samples averaged)`            | When Network Info API is missing, download a known asset 3× and average; emit Mbps.                                             |
| 3.4 | `feat(bandwidth): APP_INITIALIZER → measure → map to quality → apply to camera constraints`  | On app boot, measure → map → open camera at resolved quality. Spinner shown during measurement (Figma screen 01).               |
| 3.5 | `feat(settings): quality override dropdown using CDK Overlay (Figma 03)`                     | Gear icon opens overlay with Low/Med/High; checkmark on selected; picking one restarts the camera stream at the new resolution. |
| 3.6 | `feat(bandwidth): ErrorBannerService — bandwidth failure defaults to Medium + notifies user` | Simulated bandwidth failure (e.g., offline CDN fetch) results in Medium + banner.                                               |
| 3.7 | `test(bandwidth): Vitest coverage for service + state`                                       | Unit tests: measure() happy path, fallback path, failure → Medium; state reducers for each action.                              |

**End state:** On load, app measures bandwidth, applies the right resolution, user can override; failures fall back to Medium with a visible notice.

---

## Phase 4 — Recording

| #   | Commit                                                                                     | Acceptance                                                                                             |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 4.1 | `feat(state): VideosState skeleton + recording state machine (idle → recording → stopped)` | Actions: StartRecording, StopRecording, RecordingCompleted, RecordingFailed.                           |
| 4.2 | `feat(recorder): MediaRecorder integration with 10-second hard cap`                        | `RecorderService.start(stream)` returns a Promise<Blob>; hard cap fires at 10s via `setTimeout`.       |
| 4.3 | `feat(recorder): start/stop controls with progress bar and timer (Figma 04)`               | Pill mutates per Figma: idle shows red circle; recording shows stop square + progress + `x.y s` timer. |
| 4.4 | `test(recorder): unit coverage for recording state transitions`                            | Tests for start → auto-stop at 10s, start → manual stop, start → MediaRecorder error.                  |

**End state:** Record button captures a Blob; 10 s hard cap enforced; stop-early works. Blob held in memory only — persistence is Phase 5.

---

## Phase 5 — Persistence

| #   | Commit                                                                   | Acceptance                                                                                              |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 5.1 | `feat(storage): VideoStorageService with Dexie (save / list / delete)`   | `save(blob, meta)`, `listAll()`, `deleteById(id)`; all async, all Promise-based.                        |
| 5.2 | `feat(storage): APP_INITIALIZER loads persisted videos into VideosState` | On boot, `listAll()` → dispatch `VideosHydrated`. Corrupt rows logged + skipped.                        |
| 5.3 | `feat(recorder): on stop, save Blob → Dexie → VideosState`               | Write-through: recorder completion dispatches `SaveRecording` which hits Dexie then emits `VideoSaved`. |
| 5.4 | `test(storage): unit coverage for service + state`                       | Fake-indexeddb tests: save+list+delete round-trip; hydrate with corrupt row; quota-exceeded path.       |

**End state:** Every recording persists. Refresh the tab → videos are still there.

---

## Phase 6 — Saved videos UI (list, playback, delete)

| #   | Commit                                                                                     | Acceptance                                                                                                              |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 6.1 | `feat(videos): saved videos list on right sidebar — thumbnails, date, duration (Figma 05)` | Each item shows first-frame thumbnail (extracted via `<video>` + `<canvas>`), `DD.MM.YYYY HH:mm`, and duration.         |
| 6.2 | `feat(videos): playback modal with scrubber, pause/play (Figma 06)`                        | Click thumbnail → CDK Dialog opens with video element and a scrubber; ESC closes; focus returns to thumbnail.           |
| 6.3 | `feat(videos): delete confirmation modal with CDK focus-trap (Figma 07)`                   | Trash icon → confirmation dialog; Cancel closes; Delete dispatches `DeleteVideo` action that cascades to Dexie + state. |

**End state:** Full CRUD against saved videos — list, play, delete. All Figma screens reproduced.

---

## Phase 7 — Polish & submission

| #   | Commit                                                                                    | Acceptance                                                                                 |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 7.1 | `style: responsive breakpoints (mobile / tablet / desktop)`                               | Sidebar collapses to bottom drawer on < 768 px; recorder controls stay tappable on mobile. |
| 7.2 | `chore: a11y pass — focus traps on modals, aria-live on timer, keyboard navigation`       | Axe DevTools: zero critical issues on main page + each modal.                              |
| 7.3 | `chore: add key-state screenshots to /screenshots/`                                       | 7 screenshots matching Figma states in `/screenshots/`, referenced from README.            |
| 7.4 | `docs: README final — setup, persistence rationale, screenshots, assumptions, challenges` | README's Assumptions section + Screenshots section populated.                              |
| 7.5 | `chore: final lint + test + production build sweep`                                       | `npm run lint && npm test && npm run build` all succeed clean.                             |

**End state:** Ready to submit.

---

## Scope guardrails

- **Do not** add server-side pieces, user accounts, sharing, editing, or PWA features.
- **Do not** swap Dexie / NGXS / CDK / Vitest / Angular version without re-confirming with the project owner — they are locked decisions, see [`architecture.md`](architecture.md#2-decision-log).
- Each commit should leave the app **buildable** (`npm run build` succeeds). Phase boundaries must leave it **functional** (not just compilable).
- Any deviation from a planned commit in this file: update this file **in the same commit** that introduces the change.
