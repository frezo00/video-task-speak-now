# Design notes

Written reference for the Figma design. This file captures everything we need for implementation so that a fresh reviewer can understand each screen without opening Figma.

---

## Layout — all screens

Two-column layout:

- **Main area (≈ 4/5 width):** rounded-rectangle dark container. Houses the live webcam preview, the recorder pill at the bottom, and modal overlays (playback, delete confirmation).
- **Right sidebar (≈ 1/5 width):** dark-grey panel. Empty state shows a camera icon + "There are no recorded videos yet." When populated, stacks saved-video cards vertically with scroll.
- **Outer frame:** subtle light-grey background surrounds the two columns with equal margin.

On load the top-left shows a tiny breadcrumb-style label ("start video recorder", "start video recorder > settings", etc.) — this can be implemented as a simple `<header>` or skipped if it doesn't pull its weight.

---

## Screen 01 — Bandwidth check / loading

- **Main area:** empty black panel with a small, centered circular spinner. No controls visible.
- **Sidebar:** empty dark panel, no camera icon yet.
- **Header label:** "start video recorder".
- **Interaction:** no input accepted. Waits for bandwidth measurement and camera stream to resolve.
- **Implementation notes:** use `SpinnerComponent`; add `aria-busy="true"` on the main area; short-circuit if measurement resolves instantly (don't flash the spinner for < 150 ms).

---

## Screen 02 — Idle recorder (no recordings)

- **Main area:** live webcam preview fills the rounded panel. Mirrored horizontally (user's right appears right). Bottom-centered recorder pill: dark rounded bar with a single **red circle button** centered. Top-left has a tiny settings-gear icon.
- **Sidebar:** camera-off icon (outline) centered vertically, small caption "There are no recorded videos yet."
- **Header label:** "start video recorder".
- **Interaction:** clicking the red button starts recording (transition → screen 04). Gear icon opens screen 03.

---

## Screen 03 — Quality / settings dropdown

- Same base as screen 02 plus a **CDK Overlay** anchored to the gear icon (bottom-left).
- Overlay content: small dark card with three rows
  - `360p (Low Quality)` — muted text when unselected
  - `720p (Medium Quality)`
  - `1080p (High Quality)` — shows a **green checkmark** when selected
- An **X close button** (circular, dark) sits at the bottom-left of the overlay card.
- **Interaction:** clicking a row dispatches `SetQuality` and closes the overlay. Clicking X or outside also closes it. Escape closes and returns focus to the gear.
- **Note:** the currently-selected row gets the checkmark regardless of whether it was auto-detected or manually picked.

---

## Screen 04 — Recording in progress

- Same base as screen 02. The pill mutates:
  - **Stop button** on the left: circular with a **blue square** (same blue as the playback buttons).
  - To the right of the button: a **linear progress bar** that fills over 10 s.
  - Timer text on the far right: `3.1 s` (one decimal). Resets on start, freezes on stop.
- **Interaction:** pill click = stop. Auto-stops at 10.0 s. Stopping transitions directly to save → screen 05 with the new video appended to the top of the sidebar.
- **Implementation notes:** progress uses `requestAnimationFrame`, not CSS transitions, so the timer stays in sync. Pause when tab is hidden (`document.hidden`) to avoid jittery progress.

---

## Screen 05 — Populated videos list

- Same base as screen 02 (idle). The sidebar is now populated:
  - Vertical stack of **video cards**. Each card:
    - Thumbnail (4:3 or 16:9 matching the recording's aspect ratio).
    - Bottom-left overlay: date `31.01.2025 13:30`.
    - Bottom-right overlay: duration `10s` (or `3s`, `7s`, etc.).
    - On hover: a **trash can icon** appears in the top-right.
  - Newest video on top.
  - Scrollable when the list exceeds the viewport.
- **Interaction:** clicking a card opens playback (screen 06). Clicking the trash icon opens delete confirmation (screen 07).

---

## Screen 06 — Playback modal

- Base dimmed behind a CDK Dialog (focus-trapped).
- Dialog: rounded light-grey card, centered. Contents:
  - Video player at the top (16:9-ish).
  - Below: a **play/pause button** (blue circle) on the left, a **scrubber** to the right.
  - Top-right: **X close button** (circular, dark).
- **Interaction:** clicking a thumbnail in screen 05 opens this modal paused on the first frame; the user clicks the play button to start playback. Scrubber seeks. Pause toggles icon. Escape closes. Focus returns to the originating thumbnail.

---

## Screen 07 — Delete confirmation

- Base dimmed. Dialog: smaller than playback. Red-accent.
- Contents:
  - Small red warning icon (rounded, minimal).
  - Heading: "Delete this video?"
  - Body: one-liner like "Are you sure you want to delete this video? This action cannot be undone."
  - Two buttons side-by-side at the bottom:
    - `Cancel` — ghost/outline style.
    - `Delete` — filled red, white text.
- **Interaction:** Cancel or Escape closes without deleting. Delete dispatches `DeleteVideo`, closes the dialog, removes the card from the sidebar.

---

## UI kit inventory

The Figma file ships a UI-kit frame with the following atoms. Treat this as the authoritative inventory:

| Atom                          | Variants                                                                            | Notes                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Recorded video card**       | default, hover (trash icon appears)                                                 | Thumbnail + date overlay + duration overlay.                    |
| **Record button**             | idle (small red circle in white disc), active ("pressed")                           | Both variants shown — same size, slightly darker red on active. |
| **Stop button**               | default (blue square in white disc), active                                         | Mirrors record button.                                          |
| **Trash icon**                | default, hover                                                                      | Small stroke icon, darkens on hover.                            |
| **Settings cog**              | default, active                                                                     | Dark circular button with gear.                                 |
| **Close (X) button**          | default                                                                             | Dark circular button with X.                                    |
| **Quality list row**          | `360p (Low)`, `720p (Medium)`, `1080p (High)`; each: default / selected (checkmark) | All three shown; selected has a small green check on the right. |
| **Recorder pill — idle**      | —                                                                                   | Dark rounded bar with red record button centered.               |
| **Recorder pill — recording** | —                                                                                   | Stop button on left + progress bar + timer `3.1 s` on right.    |
| **Play / Pause buttons**      | play, pause                                                                         | blue filled circles with white icon.                            |

---

## Design tokens

Extracted from UI-kit observation (values approximate — calibrate in Phase 1 from Figma inspect panel):

### Color palette

```scss
// Backgrounds
$bg-outer: #ededed; // light grey outside the main frame
$bg-main: #2a2b2d; // dark main panel
$bg-sidebar: #1f2022; // slightly deeper sidebar
$bg-surface: #ffffff; // dialogs / playback modal
$bg-pill: #3a3b3d; // recorder pill background

// Accents
$accent-red: #e53935; // record button
$accent-blue: #2563eb; // stop button (matches blue family)
$accent-blue: #4f46e5; // play/pause circles
$accent-green: #22c55e; // selected-quality checkmark

// Text
$text-primary: #ffffff; // on dark surfaces
$text-secondary: #b7b8ba; // muted text, date/duration overlays
$text-dark: #1f1f20; // on light surfaces
$text-danger: #e11d48; // delete dialog heading + button
```

### Typography

- Primary family: **Lato** (loaded from Google Fonts; weights 400 + 700). Fallback stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- Scale: 12 (caption / timer), 14 (body / list rows), 16 (dialog body), 18 (dialog headings).
- Weights: 400 (normal) and 700 (bold). Bold is used for dialog headings and dangerous action buttons; everything else is normal. Expand the Google Fonts URL and the weight tokens together if a richer scale becomes needed.

### Spacing

8px base grid inferred from the UI kit. Use multiples: 4, 8, 12, 16, 24, 32.

### Radii

- Buttons: fully round (50%) — all circular controls in the UI kit.
- Pill / card / dialog: 12 px for large surfaces, 8 px for dropdown rows.

### Shadows

- Minimal. Dialogs use a single soft drop-shadow (blur 24, y-offset 8, 10% black).
- Buttons do **not** use drop-shadows in the base state.

---

## Responsiveness

- **Desktop (≥ 1024 px):** two columns as described.
- **Tablet (768–1023 px):** sidebar narrows to ~200 px; thumbnails go single-column with tighter padding.
- **Mobile (< 768 px):** sidebar becomes a bottom drawer, toggleable from a "Videos (N)" chip below the recorder pill. Recording controls stay prominent in the main area.
- All dialogs take full width with 16 px margin on mobile.
