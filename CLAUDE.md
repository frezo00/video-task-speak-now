# CLAUDE.md — project guidance for Claude Code

Context for any Claude Code session working in this repo.

## What this project is

Angular front-end application: bandwidth-adaptive webcam recorder with persistent storage. Full overview in [`README.md`](README.md). Detailed brief in [`docs/assignment.md`](docs/assignment.md).

## Stack (locked — don't swap without asking)

- **Angular 21.2.x** — zoneless, standalone components, signals-first
- **NGXS 21.x** — application state
- **Angular CDK** — Overlay, Dialog, Portal, FocusTrap (no Angular Material)
- **Dexie.js** — IndexedDB wrapper for video Blob persistence
- **Vitest** — unit tests (Angular 21 default)
- **Plain SCSS** — no Tailwind, no Material

## Commit conventions

- **Conventional Commits** format: `type(scope): subject`
  - Types used: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`
  - Examples: `feat(recorder): 10s hard cap`, `test(bandwidth): state reducer coverage`
- **One concern per commit.** No bundling unrelated work. The brief explicitly asks for incremental history.
- Each commit should leave the app in a buildable state (`npm run build` succeeds).
- Phase boundaries (see `docs/task-breakdown.md`) should leave the app **functional**, not just buildable.

## Repo hygiene

- Do not add dependencies without stating the rationale in a commit message or in `docs/architecture.md`'s decision log.

## Testing

- Unit tests live beside source as `*.spec.ts`.
- Scope for v1: services (Bandwidth, Camera, Storage) + NGXS state reducers only. Component tests and E2E are out of scope unless the user asks.
- Run: `npm test` (Vitest watch mode) or `npm run test:ci` (single run).

## Navigation

- Phase progress & next commits: [`docs/task-breakdown.md`](docs/task-breakdown.md)
- Architecture & layer boundaries: [`docs/architecture.md`](docs/architecture.md)
- UI / Figma reference (since PNGs aren't committed): [`docs/design-notes.md`](docs/design-notes.md)
- Storage design: [`docs/persistence.md`](docs/persistence.md)
