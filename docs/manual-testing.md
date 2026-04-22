# Manual testing

Step-by-step procedures for reproducing behaviors that can't be exercised from a Vitest run — either because they depend on real browser APIs, real throttling, or both. Unit coverage for the same logic lives beside each source file as `*.spec.ts`; this document only covers the flows that need a live browser.

Append a new section per phase as new manually-verified behavior lands.

---

## Phase 3 — bandwidth detection & quality selection

[`BandwidthService`](../src/app/core/bandwidth/services/bandwidth.service.ts) reads `navigator.connection.downlink` first and only falls back to a timed download against `https://speed.cloudflare.com/__down?bytes=500000` when the API is unavailable or returns a non-positive value.

On Chromium desktops `navigator.connection.downlink` is always a positive number, so the Cloudflare fallback never runs by default. DevTools **Network → Throttling** does **not** change `navigator.connection.downlink` — it only throttles outgoing HTTP. To exercise the throttling-based test cases we need to force the fallback path.

### Force the fallback path

Temporarily add this `<script>` to [`src/index.html`](../src/index.html) inside `<head>` (do **not** commit):

```html
<script>
  Object.defineProperty(Navigator.prototype, 'connection', {
    value: undefined,
    configurable: true,
  });
</script>
```

This runs before Angular bootstraps, shadows the native `connection` getter on the prototype, and makes `navigator.connection` evaluate to `undefined`. `BandwidthService.#readNetworkInformation()` then returns `null` and `measure()` falls through to the 3-sample Cloudflare probe — which **is** affected by DevTools throttling and URL blocking.

Equivalent DevTools-only alternative (no file edit): Sources → Overrides → save `index.html` for overrides → add the same `<script>` to the saved copy → reload. Use this when you don't want a dirty working tree.

Revert by deleting the script (or reverting `src/index.html`) before committing.

### Test matrix

Run `npm start`, open DevTools, keep the script in `index.html`, then for each row: apply the DevTools setup, reload, and confirm the expected result.

| #   | DevTools setup                                                                                                                                                         | Expected result                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Throttling **No throttling**, no URL block                                                                                                                             | Preview opens at **1080p** (camera-permitting). Real downlink > 5 Mbps via the three averaged Cloudflare probes.                                                                        |
| 2   | Throttling **Custom: 3000 kb/s down, 750 kb/s up, 40 ms latency**                                                                                                      | Preview opens at **720p**. Probes land in the 2–5 Mbps band.                                                                                                                            |
| 3   | Throttling **Slow 3G** (built-in preset)                                                                                                                               | 150 ms spinner, then preview opens at **360p**. Probes land below 2 Mbps.                                                                                                               |
| 4   | No throttling, **block `speed.cloudflare.com/__down*`** (right-click a probe request → Block request URL, or add the pattern in More tools → Network request blocking) | 150 ms spinner, all 3 probes show `(blocked:devtools)`, preview opens at **720p**, banner reads _"Couldn't measure bandwidth — defaulting to Medium. You can change it from settings."_ |

Notes:

- With **Slow 3G**, probe time approaches the per-sample 8 s timeout ([`BANDWIDTH_PROBE_TIMEOUT_MS`](../src/app/core/bandwidth/models/bandwidth.constants.ts)). If any probe times out, you'll land on the failure banner (row 4) instead of 360p (row 3) — that's the designed boundary behavior, not a bug.
- Filter the Network tab by `cloudflare` to make the three probe requests easy to spot and right-click.
- Tier thresholds (`< 2 → low`, `2–5 → medium`, `> 5 → high`) live in [`BandwidthService.mapToQuality`](../src/app/core/bandwidth/services/bandwidth.service.ts).

### Quality override menu

Does not require the `navigator.connection` override.

- Click the gear → menu opens above-right of the gear with three rows; the current tier shows a green check.
- **X / Esc / outside click** each close the menu and return focus to the gear.
- Selecting a different tier swaps the preview within ~500 ms; the check moves to the new row on next open.
- After a manual selection, a subsequent re-measurement does not override the user's choice (`QualityState` tracks `manuallyOverridden`).
- **Tab** cycles within the menu (CDK focus trap).

### A11y smoke

- VoiceOver / NVDA announces the spinner as _"Loading"_, the menu as _"Recording quality, menu, 3 items"_, and each row as e.g. _"720p Medium Quality, checked"_.
