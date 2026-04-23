# Code conventions

Rules apply to TypeScript, Angular components/directives/pipes, NGXS state, and Vitest specs. SCSS conventions live further down the file (section 8). Rules are enforced by ESLint + the TypeScript compiler where possible; the rest is code review. Every rule has a reason — don't bend them, but also don't lawyer them when the spirit disagrees.

---

## 1. TypeScript

### 1.1 No `enum` — use `as const` + `satisfies`

**Why:** TypeScript enums emit runtime code that doesn't tree-shake cleanly, produce opaque numeric values by default, and are awkward to iterate. The `as const` + `satisfies` pattern gives full type safety, zero runtime weight beyond the literal, and plays nicely with JSON/APIs.

**Naming by shape:**

- **Arrays of literal values** → `SCREAMING_SNAKE_CASE`. They read as module-scope constants you iterate or fold into a union type.
- **Objects that replace an `enum`** → `PascalCase`. Callers write `HttpStatus.Ok` — the access site mimics the enum the object replaces, so the binding should too.

```ts
// Array form — SCREAMING_SNAKE_CASE
const QUALITY_TIERS = ['low', 'medium', 'high'] as const satisfies readonly string[];
type Quality = (typeof QUALITY_TIERS)[number]; // 'low' | 'medium' | 'high'

// Object form — PascalCase (accessed like an enum)
const HttpStatus = {
  Ok: 200,
  Created: 201,
  NotFound: 404,
} as const satisfies Record<string, number>;
type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus]; // 200 | 201 | 404
```

Enforced by `no-restricted-syntax` on `TSEnumDeclaration` — ESLint will block any `enum`.

### 1.2 `interface` vs `type`

- `interface` for **object shapes** that are part of a public/exported contract, especially ones callers may extend or `implements` on a class.
- `type` for **unions, tuples, mapped types, conditional types, and narrow aliases**.

```ts
interface RecordingSession {
  readonly id: string;
  readonly startedAt: Date;
}
type Quality = 'low' | 'medium' | 'high';
type NonEmpty<T> = readonly [T, ...T[]];
```

### 1.3 `readonly` by default

Every class field, local `const`, and array parameter is `readonly` unless a reassignment is intentional. `ReadonlyArray<T>` / `readonly T[]` for parameters we don't mutate. Enforced at class-field level by `@typescript-eslint/prefer-readonly`; for parameters and locals it's code review.

```ts
readonly $count = signal<number>(0);     // immutable field, mutable signal state
readonly items: readonly string[] = [];  // the array is not reassignable and not pushed to
```

### 1.4 Explicit return types on every function — including `void`

**Why:** Explicit return types make intent visible at the declaration, catch accidental type widening, and make diffs stable (a function body change can't silently change the external signature). Applies to function declarations, methods, and named arrow functions. Inline callbacks passed as arguments (e.g. `map((x) => x * 2)`) are allowed to infer — the context already constrains them, which pairs with the explicit-generic rule on signal factories in §2.4.

```ts
getUser$(id: string): Observable<User> { ... }
handleClick(): void { ... }
const formatName = (user: User): string => `${user.first} ${user.last}`;
```

Enforced by `@typescript-eslint/explicit-function-return-type` + `explicit-module-boundary-types`.

### 1.5 `satisfies` over type annotations for literals

Use `satisfies` when you want to verify a value matches a type **without widening** the inferred type. Annotations (`const x: Type = ...`) widen; `satisfies` preserves the literal shape.

```ts
const ROUTES = {
  home: '/',
  videos: '/videos',
} as const satisfies Record<string, string>;

ROUTES.home; // type: '/' (not widened to string)
```

### 1.6 No `any`, no non-null `!`, no stray `as`

- `any` disables type-checking — use `unknown` + narrowing (`typeof`, `instanceof`, user-defined type guards) instead.
- Non-null assertions (`!`) hide real bugs. If you truly know a value is defined, use a type guard or assertion function that encodes that proof.
- `as` is only for crossing a real type boundary (`parseInt(raw) as UserId` when branding a primitive, or asserting a `Document` API return). Never as a way to silence the compiler.

Enforced by `@typescript-eslint/no-explicit-any`; `!` and `as` are code review.

### 1.7 Branded types at domain boundaries

When a primitive represents a domain concept (IDs, opaque tokens, units), brand it:

```ts
type Millis = number & { readonly __brand: 'Millis' };
const toMillis = (n: number): Millis => n as Millis;
```

This prevents accidental cross-wiring (`setTimeout(fn, userIdAsNumber)` won't compile).

### 1.8 Private field style — `readonly #x` (ECMAScript private)

**Rule:** use the native `#field` syntax for every private class member. Never the TypeScript `private` modifier, never a leading underscore as a "private convention".

```ts
export class Recorder {
  readonly #mediaStream = inject(MediaStream);
  readonly #destroyRef = inject(DestroyRef);

  start(): void {
    this.#mediaStream.getTracks().forEach((t) => t.stop());
  }
}
```

**Why `#` over `private _x`:**

|                             | `readonly #x`                                         | `private readonly _x`                              |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Runtime encapsulation       | True — inaccessible from outside the class at runtime | None — TS `private` is erased at emit              |
| Accidental leakage          | Impossible (hidden from `Object.keys`, `for..in`, DI) | Possible via `(svc as any)._x` cast                |
| Lint enforceability         | Syntactic — can't be bypassed                         | Prefix-only; easy to forget the `_`                |
| Noise at read sites         | `this.#x` reads as private                            | `this._x` reads as "maybe private, per convention" |
| Serialization / introspect. | Always hidden — matches intent                        | Shows up unless explicitly filtered                |

The only meaningful drawback to `#` is test ergonomics — you can't reach a `#` field from a spec via `any` cast. We accept that: tests should exercise the public surface, and the utility-extraction rule (§5) pushes logic to exportable helpers where behaviour-level tests are natural.

Enforced by `no-restricted-syntax` — any `private` modifier on a `PropertyDefinition`, `MethodDefinition`, or `TSParameterProperty` is a lint error.

### 1.9 Import paths — aliases for cross-library, relative for intra-library

`tsconfig.json` declares four path aliases that resolve against the `src/app/` tree:

```jsonc
"paths": {
  "@app/*":       ["src/app/*"],
  "@core/*":      ["src/app/core/*"],
  "@features/*":  ["src/app/features/*"],
  "@shared/*":    ["src/app/shared/*"],
}
```

**Rule:**

- **Cross-library imports → alias.** When one library reaches into another, import through the target's `index.ts` barrel using an alias. This keeps boundaries visible at the call site and avoids `../../../../` noise as the tree deepens.
- **Intra-library imports → relative.** Inside a single `core/<domain>/` or `features/<name>/` library, use relative paths. Aliases for sibling files in the same library obscure the fact that the import stays inside the module boundary.

```ts
// good — cross-library through the barrel
import { CameraService, DEFAULT_CAMERA_CONSTRAINTS } from '@core/camera';
import { IconDirective } from '@shared/icons';
import { RecorderPageComponent } from '@features/recorder';

// good — intra-library stays relative
// file: src/app/core/camera/services/camera.service.ts
import { CameraError } from '../models/camera-error';
import { classifyCameraError } from '../utils/classify-camera-error';

// bad — reaching across libraries without the alias
import { CameraService } from '../../../../core/camera';

// bad — using the alias to import a sibling file inside the same library
// (the import now looks cross-boundary when it isn't)
import { VideoPreviewComponent } from '@features/recorder/components/video-preview/video-preview.component';
```

The `@app/*` alias is the escape hatch for imports that don't fit the `core`/`features`/`shared` split — prefer one of the narrower aliases when either fits.

Not lint-enforced — code review.

---

## 2. Angular

### 2.1 Component decorator hygiene

- **Never** write `standalone: true` — it's the default in v21 and emitting it is noise.
- **Always** `changeDetection: ChangeDetectionStrategy.OnPush` — even though the app is zoneless, OnPush is correct hygiene and the Angular team still recommends it explicitly. Our schematics set it as a default; ESLint enforces it on existing files.
- Selectors: `app-<kebab-case>` for components, `[appCamelCase]` for directives.

### 2.2 Class + file naming (classic suffix style)

Keep the classic Angular naming — the role suffix appears on both the file and the class. Angular v20+ defaults to a shorter style (`app.ts` / `class App`); we opt out of that default via the `type` schematic option in `angular.json` to avoid file-vs-class ambiguity as the tree grows.

```
app.component.ts         / class AppComponent
recorder.component.ts    / class RecorderComponent
capitalize.pipe.ts       / class CapitalizePipe     (selector: 'capitalize')
bandwidth.service.ts     / class BandwidthService
click-outside.directive.ts / class ClickOutsideDirective
videos.state.ts          / class VideosState        (NGXS state)
```

Enforced by `@angular-eslint/component-class-suffix` and `directive-class-suffix`; pipe / service / state naming is code review.

### 2.3 DI via `inject()`, never a constructor

```ts
export class VideoListComponent {
  readonly #videoStore = inject(VideoStore);
  readonly #router = inject(Router);
}
```

Enforced by `@angular-eslint/prefer-inject`.

### 2.4 Signals-first state — always with explicit generics

Use `signal`, `computed`, `linkedSignal`, `input`, `output`, `model`. `effect` only with a written reason (reacting to external imperative APIs, debug logging). Never a `BehaviorSubject` where a signal fits.

**Always specify the generic parameter on the factory call**, even when inference would give the same type. The generic pins the public shape at the declaration site, reads better in diffs, and makes transform-typed inputs possible to write.

```ts
readonly $count    = signal<number>(0);
readonly $double   = computed<number>(() => this.$count() * 2);
readonly $name     = input.required<string>({ alias: 'name' });
readonly $enabled  = input<boolean, unknown>(false, {
  alias: 'enabled',
  transform: booleanAttribute,                           // two generics: <T, TransformT>
});
readonly $selected = output<string>({ alias: 'selected' });
readonly $value    = model<number>(0, { alias: 'value' });
```

Note: `transform` is an `input()` option (not `signal()` / `model()` / `output()`). When a transform is present, `input` takes two type parameters — the post-transform value type and the raw input type. Both generics are always explicit.

This rule is not lint-enforceable (ESLint can't gate generic-argument presence) — code review is the gate.

### 2.5 Signal `$` prefix + public alias

**Rule:** every signal-valued identifier starts with `$`. For inputs, outputs, and models, expose the **unprefixed** name as the binding alias so consumers see a clean API.

```ts
readonly $name     = input.required<string>({ alias: 'name' });
readonly $enabled  = input<boolean>(false, { alias: 'enabled' });
readonly $selected = output<string>({ alias: 'selected' });
readonly $value    = model<number>(0, { alias: 'value' });

readonly $greeting = computed<string>(() => `Hello, ${this.$name()}`);
```

```html
<!-- consumer -->
<app-greeting name="Frano" [enabled]="true" (selected)="onSelect($event)" [(value)]="score" />
```

**Why the prefix:** signals are called (`$name()`) while plain fields are not. The `$` visually flags "this is a signal — read it by calling" at both declaration and use sites. This rule is documented and reviewed; ESLint allows but doesn't require the prefix (see rule comment in `eslint.config.js` for why).

### 2.6 Observable `$` suffix

On fields and on functions that return Observables.

```ts
readonly user$: Observable<User> = this.#userStore.user$;
getRecording$(id: string): Observable<Recording> { ... }
```

### 2.7 Subscriptions via `takeUntilDestroyed`

No manual `ngOnDestroy` for cleanup. Take the `DestroyRef` at construction and pipe every long-lived subscription through it:

```ts
readonly #destroyRef = inject(DestroyRef);

constructor() {
  this.#bandwidth$
    .pipe(takeUntilDestroyed(this.#destroyRef))
    .subscribe((q) => this.#onQualityChanged(q));
}
```

### 2.8 Template control flow + `track`

`@if`, `@for` (with `track`), `@switch`. Never `*ngIf` / `*ngFor` / `*ngSwitch`. Enforced by `@angular-eslint/template/prefer-control-flow`.

```html
@for (video of $videos(); track video.id) {
<app-video-tile [video]="video" />
} @empty {
<p>No recordings yet.</p>
}
```

### 2.9 No function calls in templates — prefer signals, then memo pipes

**Why:** every change-detection pass re-invokes the function; under zoneless that's fewer, but still redundant. A signal read is O(1) and tracked; a `pure` pipe memoizes.

Order of preference:

1. **Derive with `computed`:**
   ```ts
   readonly $displayName = computed<string>(() => formatName(this.$user()));
   ```
2. **Pure pipe** when the input is dynamic (e.g. inside `@for` over rows):
   ```ts
   @Pipe({ name: 'displayName', pure: true })
   export class DisplayNamePipe implements PipeTransform {
     transform(user: User): string {
       return formatName(user);
     }
   }
   ```
3. **Generic `fn` pipe** as a last resort:
   ```ts
   @Pipe({ name: 'fn', pure: true })
   export class FnPipe implements PipeTransform {
     transform<T, R>(value: T, fn: (v: T) => R): R {
       return fn(value);
     }
   }
   ```
   ```html
   {{ user | fn: formatName }}
   ```

### 2.10 No wrapper DOM element — use `host` metadata

The component's own host element is already rendered. Don't wrap the template in a `<div class="wrapper">` to carry layout / ARIA — set it on the host.

```ts
@Component({
  selector: 'app-card',
  host: {
    class: 'card',
    role: 'group',
    '[class.card--selected]': '$selected()',
  },
  template: `
    <h2>{{ $title() }}</h2>
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly $title = input.required<string>({ alias: 'title' });
  readonly $selected = input<boolean>(false, { alias: 'selected' });
}
```

In SCSS, style via `:host`. See section 8.

### 2.11 File split

`.ts` / `.html` / `.scss` are separate files. Inline templates only for trivial shells (≤ 5 lines, no logic). Schematics default enforces this.

### 2.12 Other Angular lint rules we turn on

- `@angular-eslint/prefer-signals` — no decorator-based `@Input` / `@Output`; use the function-based `input()` / `output()` API.
- `@angular-eslint/no-empty-lifecycle-method` — don't write `ngOnInit() {}` with nothing in it.
- `@angular-eslint/use-lifecycle-interface` — if you write `ngOnInit`, also `implements OnInit` (reads as an explicit contract).

---

## 3. NGXS state

- **One state per feature**, colocated with the feature folder (`src/app/features/recorder/recorder.state.ts`).
- State class named `<Feature>State` (the `State` suffix is required by NGXS — the class is a DI token).
- **Actions** grouped under a namespace, past-tense verbs — they describe what happened, not what to do:
  ```ts
  export namespace Recording {
    export class Started {
      static readonly type = '[Recording] Started';
      constructor(readonly at: Date) {}
    }
    export class AutoStopped {
      static readonly type = '[Recording] Auto Stopped';
    }
    export class Saved {
      static readonly type = '[Recording] Saved';
      constructor(readonly id: string) {}
    }
  }
  ```
- **Selectors** as `@Selector()` static methods on the state class — consumer components read via `select()` → signal.
- **No direct state mutation from components.** Components dispatch actions; state handlers are the only place that writes state.

---

## 4. Shared-code documentation (TSDoc)

Every **exported** symbol in `src/app/shared/**` carries a TSDoc block — consumers get hover-tooltips in the editor and the rules below keep them useful. Feature-local code (a private helper inside a feature module) doesn't need it unless the behaviour is subtle.

Required tags:

- Summary sentence (one line, what it does).
- `@param` for each parameter — include units (`ms`, `bytes`), constraints (`must be > 0`), or the meaning of special values (`null = not loaded`).
- `@returns` — shape of the return, especially for optionals (`null when the user has not granted permission`).
- `@example` for non-trivial call sites.
- `@throws` when the function can throw.

```ts
/**
 * Measures current download bandwidth by fetching a known asset.
 *
 * @param url - Absolute URL of the probe asset; must return ≥ 100 kB.
 * @returns Measured throughput in megabits per second, or `null` if the
 *   probe times out within {@link BANDWIDTH_PROBE_TIMEOUT_MS}.
 * @throws {BandwidthProbeError} When the response is not 200.
 * @example
 * const mbps = await measureBandwidth$(BANDWIDTH_PROBE_URL);
 */
export async function measureBandwidth$(url: string): Promise<number | null> { ... }
```

---

## 5. Utility extraction rule

Start inside the component/directive/pipe. Move to `src/app/shared/utils/` **only** when a second call site appears — not before.

- Three similar lines is better than a premature abstraction.
- A helper method on one class is better than a global utility that's used once.
- When extracting, pick a name that describes the _operation_, not the original call site.

---

## 6. Testing (Vitest)

Scope for v1 (per [CLAUDE.md](../CLAUDE.md)): services + NGXS reducers only. Component / E2E tests are out of scope unless explicitly requested.

- Specs colocated with source: `bandwidth.service.ts` + `bandwidth.service.spec.ts`.
- AAA layout (Arrange / Act / Assert).
- **One behaviour per `it`.** No "it does everything correctly" tests.
- Nested `describe` mirrors the public API surface of the unit under test — `describe('BandwidthService > measure', ...)`.
- Prefer real dependencies over mocks when cheap (an in-memory Dexie, a fake `fetch`). Mock only at system boundaries.
- Don't test implementation details (private fields, internal methods) — test the observable behaviour. Because privates are `#` (§1.8), this rule is enforced by the language.

---

## 7. File / folder naming

- **kebab-case** for all source files and folders: `bandwidth-meter.service.ts`, `video-list/`.
- **PascalCase** for classes, interfaces, type aliases: `BandwidthMeterService`, `VideoListState`.
- **camelCase** for variables, functions, methods.
- **SCREAMING_SNAKE_CASE** for top-level module constants and `as const` arrays (§1.1): `const BANDWIDTH_PROBE_URL = '...'`, `const QUALITY_TIERS = [...]`.
- **PascalCase** for `as const` objects that replace enums (§1.1): `const HttpStatus = { Ok: 200 } as const`.
- Spec files end `*.spec.ts`, always alongside the source.

---

## 8. SCSS

Most of these rules are enforced by Stylelint (`.stylelintrc.json`). Some — tokens vs literals, `:host` discipline — are code review.

### 8.1 File organization

- **Global styles live in `src/styles/`:**
  - `_tokens.scss` — design tokens. **Defines CSS custom properties** under `:root` (plus theme variants like `:root.dark`) **and** the SCSS variables that point at them. Token values are the source of truth from [`docs/design-notes.md`](design-notes.md).
  - `_mixins.scss` — breakpoint mixins, focus-ring mixin, motion-guarded transition mixin.
  - `_reset.scss` — minimal reset (box-sizing, `:focus-visible` baseline, `prefers-reduced-motion` override).
- `src/styles.scss` imports each partial **once** via `@use`.
- **Component styles stay colocated** with the component (`video-tile.component.scss` beside `video-tile.component.ts`).

### 8.2 `@use` only, never `@import`

`@import` is deprecated in Sass. Use `@use` with a namespace so identifiers don't leak into the global scope.

```scss
// good
@use 'styles/tokens' as tokens;
@use 'styles/mixins' as mx;

.video-tile {
  padding: tokens.$space-3;
  @include mx.focus-ring;
}
```

### 8.3 Tokens — CSS custom property under `:root`, SCSS variable points at it

No hex, rem, px, or magic numbers in component styles. Every design value is **a CSS custom property declared once on `:root`** (with theme variants on `:root.light` / `:root.dark`), and **a SCSS variable that is literally `var(--name)`**. Components use the SCSS variable. This gives you:

- **Runtime theming** — toggle a class on `<html>` and every component re-theres with no JS restyle and no SCSS recompile.
- **Stable, namespaced SCSS identifiers** — `tokens.$color-text-primary` is the name every component uses. You can move the underlying value without rewriting callers.

```scss
// src/styles/_tokens.scss

// 1. Declare the CSS custom properties on :root (light is the default).
:root,
:root.light {
  --color-text-primary: #2a2b2d;
  --color-surface: #ffffff;
  --color-accent: #1d70ff;

  --radius-md: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
}

:root.dark {
  --color-text-primary: #f2f2f2;
  --color-surface: #111113;
  --color-accent: #4a8dff;
}

// 2. SCSS variables are pointers — one line each, deliberately boring.
$color-text-primary: var(--color-text-primary);
$color-surface: var(--color-surface);
$color-accent: var(--color-accent);
$radius-md: var(--radius-md);
$space-3: var(--space-3);
$space-4: var(--space-4);
```

```scss
// any component uses the SCSS variable
@use 'styles/tokens' as tokens;

.video-tile {
  padding: tokens.$space-3;
  color: tokens.$color-text-primary;
  border-radius: tokens.$radius-md;
}
```

**Exception — tokens that feed compile-time math.** Breakpoint widths, grid column counts, and anything you do SCSS arithmetic on (`calc()` is fine in CSS but `tokens.$breakpoint-tablet * 1.5` isn't) must live as plain SCSS values, not `var(--x)`. Keep those in `_mixins.scss` or a separate `_breakpoints.scss` partial; they aren't themable at runtime anyway.

### 8.4 Selectors — BEM-lite, max 3 levels of nesting

`.block__element--modifier`. Enforced by Stylelint `selector-class-pattern` + `max-nesting-depth: 3`.

```scss
.video-list {
  display: grid;

  &__tile {
    aspect-ratio: 16 / 9;
  }

  &__tile--selected {
    outline: 2px solid tokens.$color-accent;
  }
}
```

### 8.5 `:host` for scoping, never `::ng-deep`

Component styles target the host (not a wrapper element — see Angular rule 2.10). If you need to reach a child component's internals, expose a CSS custom property on it instead of piercing encapsulation.

```scss
// component.scss
:host {
  display: block;
  padding: tokens.$space-4;
}

// no ::ng-deep, no :host-context hacks
```

### 8.6 Logical properties

Prefer logical properties over physical ones — they work with any writing mode, and layout-ready for i18n:

- `padding-inline` / `padding-block` over `padding-left` / `padding-top`
- `margin-inline` / `margin-block`
- `inset-inline` / `inset-block`
- `inline-size` / `block-size` over `width` / `height` (when the axis is semantic, not a pixel target)

### 8.7 Responsive — breakpoint mixins, `clamp()` for fluid

Breakpoints from [`docs/design-notes.md`](design-notes.md) live as mixins in `_mixins.scss`:

```scss
// _mixins.scss
@mixin for-tablet {
  @media (min-width: 48rem) {
    @content;
  }
}
@mixin for-desktop {
  @media (min-width: 72rem) {
    @content;
  }
}

// component.scss
.hero {
  font-size: clamp(1.25rem, 2vw + 1rem, 2rem);

  @include mx.for-desktop {
    grid-template-columns: 2fr 1fr;
  }
}
```

### 8.8 Motion respects `prefers-reduced-motion`

Every transition / animation is wrapped in a motion-guard mixin so reduced-motion users aren't punished:

```scss
// _mixins.scss
@mixin motion($props) {
  @media (prefers-reduced-motion: no-preference) {
    transition: $props;
  }
}

// component.scss
.pill {
  @include mx.motion(background-color 160ms ease);
}
```

### 8.9 A11y — contrast + `:focus-visible`

- Minimum WCAG AA (4.5:1 for text, 3:1 for large text / UI) — achieved by pairing tokens from `_tokens.scss`, never ad-hoc hexes.
- Every interactive element ships a `:focus-visible` style. Use the `focus-ring` mixin so it's consistent.
- Never `outline: none` without a replacement focus style.

### 8.10 No `!important`

Enforced by Stylelint (`declaration-no-important`). If a rule is being overridden unexpectedly, fix the specificity, not the symptom.
