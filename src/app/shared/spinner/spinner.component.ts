import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Small circular loading spinner. Animation respects
 * `prefers-reduced-motion`.
 *
 * @example
 * <app-spinner label="Measuring bandwidth" />
 */
@Component({
  selector: 'app-spinner',
  template: `<span class="spinner__circle" aria-hidden="true"></span>`,
  styleUrl: './spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'spinner',
    role: 'status',
    '[attr.aria-label]': '$label()',
  },
})
export class SpinnerComponent {
  readonly $label = input<string>('Loading', { alias: 'label' });
}
