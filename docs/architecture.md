# Architecture

## 1. High-level layers

```
┌────────────────────────────────────────────────────────────────────┐
│  Presentation (standalone components, signals)                     │
│    ├─ RecorderPageComponent      — main page, composes the rest    │
│    ├─ VideoPreviewComponent      — live webcam <video> element     │
│    ├─ RecorderControlsComponent  — pill bar (record/stop/progress) │
│    ├─ QualityMenuComponent       — CDK Overlay with Low/Med/High   │
│    ├─ VideosListComponent        — right sidebar with thumbnails   │
│    ├─ PlaybackDialogComponent    — CDK Dialog with scrubber        │
│    └─ ConfirmDeleteDialogComponent                                 │
│                                                                     │
│    + Shared UI: ErrorBannerComponent, SpinnerComponent,            │
│      IconButtonComponent, Pill                                     │
└────────────────────────────────────────────────────────────────────┘
                              ▲ selectors
                              ▼ actions
┌────────────────────────────────────────────────────────────────────┐
│  State (NGXS 21)                                                   │
│    ├─ BandwidthState   — measured Mbps, status, error              │
│    ├─ QualityState     — current quality (Low/Med/High) + source   │
│    │                     ('auto' | 'manual-override')              │
│    ├─ RecorderState    — idle | recording | stopping               │
│    └─ VideosState      — SavedVideo[], loaded flag                 │
└────────────────────────────────────────────────────────────────────┘
                              ▲ promises / observables
                              ▼ method calls
┌────────────────────────────────────────────────────────────────────┐
│  Services (@Injectable, signals where practical)                   │
│    ├─ BandwidthService     — measure(), mapToQuality()             │
│    ├─ CameraService        — openStream(constraints), closeStream()│
│    ├─ RecorderService      — start(), stop(), 10s cap, Blob out    │
│    ├─ VideoStorageService  — Dexie CRUD + hydrate                  │
│    └─ ErrorBannerService   — push({level, msg}), queue             │
└────────────────────────────────────────────────────────────────────┘
                              ▲ browser APIs
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Infrastructure (browser APIs)                                     │
│    navigator.connection     │ MediaRecorder  │ IndexedDB (Dexie)   │
│    fetch (timed download)   │ getUserMedia   │                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Decision log

| #   | Decision                     | Chosen                                             | Alternatives considered                                        | Reason                                                                                                                                                                                                                                                                  |
| --- | ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Framework + change detection | Angular 21.2.x, zoneless                           | Angular 16/17, Angular with Zone.js                            | Latest; matches brief's "Angular" requirement; zoneless + signals give predictable change detection around MediaRecorder events.                                                                                                                                        |
| 2   | State management             | NGXS 21                                            | NgRx, Akita, plain signals                                     | Brief mandates NGXS. NGXS also has small boilerplate vs NgRx.                                                                                                                                                                                                           |
| 3   | UI / component library       | Plain SCSS + Angular CDK                           | Angular Material, Tailwind, PrimeNG                            | Figma is custom — Material would need heavy overrides. CDK gives a11y primitives (Overlay, Dialog, FocusTrap, Portal) without imposing a look.                                                                                                                          |
| 4   | Persistence                  | Dexie.js (IndexedDB)                               | Raw IndexedDB, idb-keyval, localForage, localStorage           | localStorage cannot hold blobs at any realistic size. Dexie has the best DX and TypeScript types; documents well in the README "persistence" section.                                                                                                                   |
| 5   | Bandwidth detection          | Hybrid — Network Info API, timed-download fallback | Network Info API only, timed-download only, manual picker only | `navigator.connection.downlink` is missing/unreliable on Safari/iOS. Fallback guarantees a number cross-browser.                                                                                                                                                        |
| 6   | Testing                      | Vitest, unit-only for services + NGXS              | Jasmine/Karma, Jest, + component tests, + Playwright E2E       | Vitest is Angular 21 default. Component tests and E2E mock `getUserMedia` painfully — skipping for v1.                                                                                                                                                                  |
| 7   | Deployment                   | Local run only (v1)                                | Vercel, Netlify, GitHub Pages                                  | Webcam permissions need HTTPS; all three work. Deferred to maximize core-feature budget.                                                                                                                                                                                |
| 8   | Merge strategy               | Squash-merge per PR                                | Rebase-merge, merge-commit, no policy                          | One commit per logical slice on `main`; PR pages retain granular branch history so the brief's "incremental history" requirement is met. Rebase-merge was the close runner-up but would keep incidental-fix commits (CI breaks, review follow-ups) permanently on main. |

---

## 3. Module boundaries

The app uses standalone components. Every `core/<domain>/` and `features/<name>/` folder is structured as a self-contained "library" (Nx-style): stable public surface via `index.ts`, internals organised by role (`models/`, `services/`, `utils/`, `pages/`, `components/`, `state/`). Each component lives in its own folder so `.ts` + `.html` + `.scss` (and a future `.spec.ts`) stay colocated.

```
src/app/
├── app.config.ts              # provideStore, APP_INITIALIZER, CDK providers
├── app.routes.ts              # single route → RecorderPageComponent (if/when routing is introduced)
├── core/                      # cross-cutting domain libraries
│   ├── bandwidth/
│   │   ├── models/
│   │   ├── services/
│   │   │   └── bandwidth.service.ts
│   │   ├── state/
│   │   │   └── bandwidth.state.ts
│   │   └── index.ts           # public barrel
│   ├── camera/
│   │   ├── models/            # CameraError, CameraStatus, DEFAULT_CAMERA_CONSTRAINTS
│   │   ├── services/
│   │   │   └── camera.service.ts
│   │   ├── utils/             # e.g. classify-camera-error.ts
│   │   └── index.ts
│   ├── storage/
│   │   ├── models/            # dexie schema, SavedVideo type
│   │   ├── services/
│   │   │   └── video-storage.service.ts
│   │   └── index.ts
│   ├── error/
│   │   ├── services/
│   │   │   └── error-banner.service.ts
│   │   └── index.ts
│   └── initializers.ts        # APP_INITIALIZER orchestration
├── features/                  # user-facing feature libraries
│   ├── recorder/
│   │   ├── pages/
│   │   │   └── recorder-page/
│   │   │       ├── recorder-page.component.{ts,html,scss}
│   │   ├── components/
│   │   │   ├── video-preview/
│   │   │   ├── recorder-controls/
│   │   │   ├── quality-menu/
│   │   │   ├── permission-denied-dialog/
│   │   │   └── no-device-dialog/
│   │   ├── state/
│   │   │   ├── recorder.state.ts
│   │   │   └── quality.state.ts
│   │   └── index.ts           # exports RecorderPageComponent only
│   └── videos/
│       ├── components/
│       │   ├── videos-list/
│       │   ├── playback-dialog/
│       │   └── confirm-delete-dialog/
│       ├── state/
│       │   └── videos.state.ts
│       └── index.ts
└── shared/                    # leaf UI atoms — no business logic
    ├── icons/                 # [appIcon] directive + icomoon font
    ├── error-banner/
    ├── spinner/
    ├── icon-button/
    └── pill/
```

Global styles that express design-system patterns (tokens, reset, icon base, dialog panel) live in `src/styles/*.scss` and are pulled into `src/styles.scss`. Components use global BEM classes like `.dialog-panel` on their `host` rather than duplicating the SCSS per component.

**Rules:**

- `features/*` may depend on `core/*` and `shared/*`, never on each other.
- `core/*` may depend on `shared/*` and other `core/*` siblings.
- `shared/*` has no app-specific dependencies — pure presentation.
- Each library's `index.ts` is the public surface. Cross-library imports go through it via the `@core/*` / `@features/*` / `@shared/*` / `@app/*` path aliases declared in `tsconfig.json`; intra-library imports use relative paths. Full rule in [`conventions.md` §1.9](conventions.md#19-import-paths--aliases-for-cross-library-relative-for-intra-library).
- State files live in the `state/` folder of the feature that owns them; cross-cutting state (`BandwidthState`) lives in `core/bandwidth/state/`.

---

## 4. Error strategy

Single `ErrorBannerService` collects user-facing errors and drives a persistent toast/banner component. Behavior per scenario:

| Scenario                             | Handling                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bandwidth API throws / times out     | Fallback to timed download. If both fail, default to **Medium** quality, push banner: _"Couldn't measure bandwidth — defaulting to Medium. You can change it from settings."_ |
| Webcam permission denied             | CDK Dialog with explanation + link to browser's permission settings. Recorder controls hidden.                                                                                |
| Webcam enumeration returns no device | CDK Dialog: _"No webcam detected. Connect one and refresh."_                                                                                                                  |
| MediaRecorder error during capture   | Banner: _"Recording failed. Try again."_ Recording state rolls back to `idle`.                                                                                                |
| Dexie quota exceeded on save         | Banner: _"Storage is full. Delete some saved videos and try again."_ Failed Blob is discarded, not persisted.                                                                 |
| Corrupt Dexie row on hydrate         | Skip the row, log to console, banner: _"N saved videos couldn't be loaded and were skipped."_                                                                                 |

**Never** use `alert()` / `confirm()` for production UI — CDK Dialog + banner only. The brief says "alerts to the user"; we interpret that as in-app notifications, not the native `alert()` function.

---

## 5. Accessibility posture

- **Focus management:** CDK `cdkTrapFocus` on every dialog/overlay. Focus returns to the invoking element on close.
- **Live regions:** `<span aria-live="polite">` wraps the recording timer so screen readers announce the countdown without being spammy.
- **Keyboard operability:** every interactive control reachable via Tab; record/stop bound to Space when the recorder pill is focused.
- **Color contrast:** verify buttons (red record, blue stop, indigo playback) meet WCAG AA against their backgrounds — captured in a final a11y pass in Phase 7.
- **Reduced motion:** progress-bar animation respects `prefers-reduced-motion`.
- **Permissions:** the CDK Dialog for permission denial explains _how_ to re-grant, not just that it's missing.

---

## 6. Non-goals

Out of scope for this assignment:

- Server-side storage, user accounts, sharing
- Uploading videos
- Editing / trimming recordings
- Multi-device or multi-window sync
- Video transcoding / format conversion (we store whatever MediaRecorder produces for the platform)
- Offline install / PWA manifest
