import { BreakpointObserver } from '@angular/cdk/layout';
import { type ConnectedPosition, Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DestroyRef, Directive, ElementRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { type QualityTier } from '@core/bandwidth';
import { MOBILE_BREAKPOINT } from '@shared/breakpoints';
import { map } from 'rxjs';
import { QualityMenuComponent } from './quality-menu.component';

const DESKTOP_POSITION: ConnectedPosition = {
  originX: 'end',
  originY: 'bottom',
  overlayX: 'start',
  overlayY: 'bottom',
  offsetX: 8,
};

// Mobile: anchor the menu's bottom-left to the trigger's top-left so it opens
// upward — there's no horizontal room for the desktop right-side placement
// when the trigger sits in the stage's bottom-left on small viewports.
const MOBILE_POSITION: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'start',
  overlayY: 'bottom',
  offsetY: -8,
};

/**
 * Attach to a `<button>` to make it open the {@link QualityMenuComponent} in a
 * CDK Overlay anchored to itself. Owns overlay lifecycle, responsive
 * positioning (right of the trigger on desktop, above on mobile), focus
 * restoration, and outside-click dismissal so the consumer only configures the
 * current tier and reacts to selections.
 *
 * Exports as `appQualityMenuTrigger` so templates can read {@link $isOpen} and
 * {@link $isMobile} via a reference variable for ARIA / icon bindings.
 */
@Directive({
  selector: 'button[appQualityMenuTrigger]',
  exportAs: 'appQualityMenuTrigger',
  host: {
    type: 'button',
    'aria-haspopup': 'menu',
    '(click)': 'toggle()',
  },
})
export class QualityMenuTriggerDirective {
  readonly #overlay = inject(Overlay);
  readonly #host = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  readonly #destroyRef = inject(DestroyRef);
  readonly #breakpoints = inject(BreakpointObserver);

  readonly $selected = input.required<QualityTier>({ alias: 'selected' });
  readonly $qualitySelected = output<QualityTier>({ alias: 'qualitySelected' });

  readonly $isMobile = toSignal(
    this.#breakpoints.observe(MOBILE_BREAKPOINT).pipe(map((state) => state.matches)),
    { initialValue: false as boolean },
  );

  readonly #$isOpen = signal<boolean>(false);
  readonly $isOpen = this.#$isOpen.asReadonly();

  #overlayRef: OverlayRef | null = null;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      this.#overlayRef?.dispose();
      this.#overlayRef = null;
    });
  }

  toggle(): void {
    if (this.#overlayRef) {
      this.#close();
      return;
    }
    this.#open();
  }

  #open(): void {
    const positions: ConnectedPosition[] = this.$isMobile()
      ? [MOBILE_POSITION, DESKTOP_POSITION]
      : [DESKTOP_POSITION, MOBILE_POSITION];
    const positionStrategy = this.#overlay
      .position()
      .flexibleConnectedTo(this.#host.nativeElement)
      .withPositions(positions)
      .withPush(true);
    const ref = this.#overlay.create({
      positionStrategy,
      scrollStrategy: this.#overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
      panelClass: 'quality-menu-panel',
    });
    this.#overlayRef = ref;
    const componentRef = ref.attach(new ComponentPortal(QualityMenuComponent));
    componentRef.setInput('selected', this.$selected());
    // OutputEmitterRef subscriptions are torn down with the attached component
    // when the overlay disposes; no manual takeUntilDestroyed needed here.
    componentRef.instance.$qualitySelected.subscribe((tier) => {
      this.$qualitySelected.emit(tier);
      this.#close();
    });
    componentRef.instance.$closed.subscribe(() => this.#close());
    ref
      .outsidePointerEvents()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((event) => {
        // Ignore pointerdowns on the host: the button's own click toggles the
        // menu. Without this, outsidePointerEvents would close it and the click
        // handler would immediately reopen it.
        const host = this.#host.nativeElement;
        if (event.target instanceof Node && host.contains(event.target)) {
          return;
        }
        this.#close();
      });
    this.#$isOpen.set(true);
  }

  #close(): void {
    if (!this.#overlayRef) {
      return;
    }
    this.#overlayRef.dispose();
    this.#overlayRef = null;
    this.#$isOpen.set(false);
    this.#host.nativeElement.focus();
  }
}
