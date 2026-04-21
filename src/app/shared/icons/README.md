# Icons

Type-safe icon-font system backed by [Icomoon](https://icomoon.io/).

## What's in here

```
src/app/shared/icons/
├── icomoon.css              # @font-face + .icon-* rules exported from Icomoon
├── icomoon-selection.json   # Icomoon source manifest — upload to edit
├── icon.directive.ts        # [appIcon] directive
├── icon.directive.spec.ts   # directive tests
├── icon.model.ts            # ICONS array + Icon / IconSize types
├── index.ts                 # barrel
└── README.md
```

Base `.icon` and `.icon--{size}` rules live globally at `src/styles/_icons.scss` — generic styling that would apply to any icon system, wired via `src/styles.scss`. `icomoon.css` is wired via `angular.json`'s `styles` array.

## Usage

```html
<i appIcon="trash"></i>
<i appIcon="settings" appIconSize="large"></i>
<i [appIcon]="$currentIcon()" [appIconSize]="$currentSize()"></i>
```

Props:

- `appIcon` (required) — one of the names in `ICONS` (typed as `Icon`).
- `appIconSize` — `'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'`, defaults to `'medium'`.

Colour follows `currentColor` — style via the parent's `color`.

## Adding or replacing icons

1. Open [icomoon.io/app](https://icomoon.io/app/) and **Import Icons** from `icomoon-selection.json`.
2. Add or remove SVGs; regenerate the font (**Download**).
3. From the downloaded zip, copy:
   - `style.css` → `src/app/shared/icons/icomoon.css` (overwrite).
   - `selection.json` → `src/app/shared/icons/icomoon-selection.json` (overwrite).
4. Update the `ICONS` array in `icon.model.ts` to match the new set — TypeScript will flag any callers that reference a removed name.
5. Verify with `npm run build && npm test`.

The font binary is base64-inlined in `icomoon.css` — no separate font files to ship. Both `icomoon.css` and `icomoon-selection.json` are listed in `.prettierignore` so Icomoon re-exports don't fight Prettier's formatting.

## Conventions applied

- `ICONS` uses `as const satisfies readonly string[]` (per [`docs/conventions.md`](../../../../docs/conventions.md) §1.1).
- Directive uses `$`-prefixed signal inputs with `alias` (§2.5), explicit generics (§2.4), and `host` metadata (§2.10).
