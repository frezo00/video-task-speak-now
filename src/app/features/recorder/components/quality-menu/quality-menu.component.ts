import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { QUALITY_PROFILES, type QualityProfile, type QualityTier } from '@core/bandwidth';
import { IconDirective } from '@shared/icons';

const TIERS: readonly QualityProfile[] = Object.values(QUALITY_PROFILES);

/**
 * Menu rendered inside a CDK Overlay anchored to the recorder's gear button.
 * Lists the three {@link QUALITY_PROFILES} with a checkmark on the active tier
 * and emits {@link qualitySelected} / {@link closed} so the host can drive the
 * camera reboot and overlay teardown.
 */
@Component({
  selector: 'app-quality-menu',
  imports: [IconDirective],
  templateUrl: './quality-menu.component.html',
  styleUrl: './quality-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    { directive: CdkTrapFocus, inputs: ['cdkTrapFocus', 'cdkTrapFocusAutoCapture'] },
  ],
  host: {
    class: 'quality-menu',
    role: 'menu',
    'aria-label': 'Recording quality',
    cdkTrapFocus: '',
    cdkTrapFocusAutoCapture: '',
    '(keydown.escape)': 'close()',
  },
})
export class QualityMenuComponent {
  readonly tiers = TIERS;
  readonly $selected = input.required<QualityTier>({ alias: 'selected' });
  readonly $qualitySelected = output<QualityTier>({ alias: 'qualitySelected' });
  readonly $closed = output<void>({ alias: 'closed' });

  select(tier: QualityTier): void {
    this.$qualitySelected.emit(tier);
  }

  close(): void {
    this.$closed.emit();
  }
}
