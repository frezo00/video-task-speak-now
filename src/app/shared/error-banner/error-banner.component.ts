import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorBannerService } from '@core/error';
import { IconDirective } from '@shared/icons';

/**
 * Renders the current {@link ErrorBannerService} queue as a floating toast
 * stack. Mount once, typically in the app shell.
 */
@Component({
  selector: 'app-error-banner',
  imports: [IconDirective],
  templateUrl: './error-banner.component.html',
  styleUrl: './error-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'error-banner',
    role: 'status',
    'aria-live': 'polite',
  },
})
export class ErrorBannerComponent {
  readonly #service = inject(ErrorBannerService);
  readonly $items = this.#service.$items;

  dismiss(id: string): void {
    this.#service.dismiss(id);
  }
}
