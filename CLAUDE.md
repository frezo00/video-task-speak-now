# CLAUDE.md — project guidance for Claude Code

Context for any Claude Code session working in this repo.

## What this project is

Angular front-end application: bandwidth-adaptive webcam recorder with persistent storage. Full overview in [`README.md`](README.md). Detailed brief in [`docs/assignment.md`](docs/assignment.md).

## Stack (locked — don't swap without asking)

- **Angular 21.2.x** — zoneless, standalone-by-default, signals-first
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
- Run: `npm test` (Vitest single run via `ng test` → `@angular/build:unit-test`).

## House rules (summary — full detail in [`docs/conventions.md`](docs/conventions.md))

- **No `enum`** — use `const X = [...] as const satisfies ...`. Arrays → `SCREAMING_SNAKE_CASE`; objects-as-enum → `PascalCase` (accessed like `HttpStatus.Ok`).
- **Private fields:** `readonly #x` (ECMAScript private). Never `private`, never a `_` prefix. Enforced by `no-restricted-syntax`.
- **Signals:** every signal-valued identifier starts with `$`. For `input()` / `output()` / `model()`, expose the unprefixed name as the `alias` so templates stay clean. Always specify the generic parameter on the factory — `signal<T>(...)`, `computed<T>(...)`, `input<T>(...)`, `input<T, TX>(..., { transform })`, `output<T>(...)`, `model<T>(...)`.
- **Observables:** `$` suffix on fields and on functions that return them (`user$`, `getRecording$()`).
- **DI:** `inject()` — never a constructor parameter.
- **Components:** never `standalone: true`; always `changeDetection: OnPush`; no wrapper `<div>` — use `host: { class, role, '[class.x]': '...' }`.
- **Templates:** `@if` / `@for` (always with `track`) / `@switch`. Never `*ngIf` / `*ngFor`. No function calls — prefer `computed` → pure pipe → `fn` pipe.
- **Classic Angular naming:** `class AppComponent` in `app.component.ts`, `class BandwidthService` in `bandwidth.service.ts`, etc. The role suffix lives on both file and class. `angular.json` schematics use `type: component` / `directive` / `pipe` / `service` to keep `ng generate` aligned.
- **Explicit return types** on every declared function, including `void`.
- **`readonly` by default** on class fields; use `readonly T[]` / `ReadonlyArray<T>` for non-mutated inputs.
- **No `any`**, no `!`, no stray `as`. Use `unknown` + narrowing.
- **Utility extraction only at the second call site** — three similar lines beats a premature abstraction.
- **Shared code** in `src/app/shared/**` needs TSDoc (summary, `@param`, `@returns`, `@example`, `@throws`).
- **SCSS:** tokens are CSS custom properties on `:root` (+ `:root.dark`) with a SCSS variable that points at `var(--x)` — components use the SCSS variable, theming flips at runtime via a class on `<html>`. `@use` (never `@import`); BEM-lite; nesting ≤ 3; `:host` for scoping; logical properties; `prefers-reduced-motion` guard on transitions; no `!important`.

## Navigation

- Phase progress & next commits: [`docs/task-breakdown.md`](docs/task-breakdown.md)
- Architecture & layer boundaries: [`docs/architecture.md`](docs/architecture.md)
- Coding conventions (TS / Angular / NGXS / SCSS): [`docs/conventions.md`](docs/conventions.md)
- UI / Figma reference (since PNGs aren't committed): [`docs/design-notes.md`](docs/design-notes.md)
- Storage design: [`docs/persistence.md`](docs/persistence.md)
