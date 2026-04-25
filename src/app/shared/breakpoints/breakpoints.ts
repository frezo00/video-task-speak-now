/**
 * Shared layout breakpoints used by both `BreakpointObserver` (TS) and the
 * `breakpoint.media(...)` mixin (SCSS) so CSS and JS layout flips stay in
 * lockstep. Edit these together with
 * `src/styles/01_helpers/_breakpoint.helper.scss`.
 */

/**
 * Max width below which the recorder sidebar collapses into a bottom drawer
 * and the playback dialog switches to its mobile layout. Mirrors the
 * `breakpoint.media(mobile)` range in `_breakpoint.helper.scss`.
 *
 * @example
 * readonly $isMobile = toSignal(
 *   inject(BreakpointObserver).observe(MOBILE_BREAKPOINT).pipe(map((s) => s.matches)),
 *   { initialValue: false },
 * );
 */
export const MOBILE_BREAKPOINT = '(width < 48rem)';
