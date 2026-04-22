import { computed, Directive, input } from '@angular/core';

import type { Icon, IconSize } from './icon.model';

/**
 * Renders an icomoon icon on the host element.
 *
 * @example
 * <i appIcon="trash"></i>
 * <i appIcon="settings" appIconSize="large"></i>
 */
@Directive({
  selector: '[appIcon]',
  host: {
    '[class]': '$hostClass()',
  },
})
export class IconDirective {
  readonly $icon = input.required<Icon>({ alias: 'appIcon' });
  readonly $size = input<IconSize>('medium', { alias: 'appIconSize' });

  readonly $hostClass = computed<string>(() => `icon icon-${this.$icon()} icon--${this.$size()}`);
}
