import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { type Icon, IconDirective } from '@shared/icons';

export type DialogResult = 'confirm' | 'dismiss';

export type ConfirmDialogType = 'info' | 'danger';

export interface ConfirmDialogData {
  readonly title: string;
  /**
   * Free-form body text. Newlines in the string are preserved in the rendered
   * output via `white-space: pre-line` — use `\n` for a line break and `\n\n`
   * for a visual paragraph break. No HTML / markdown parsing.
   */
  readonly body: string;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
  readonly type?: ConfirmDialogType;
  readonly icon?: Icon;
}

/**
 * Generic confirmation dialog rendered through CDK `Dialog`.
 *
 * Open it with typed data and consume the `'confirm' | 'dismiss'` result
 * from `DialogRef.closed`. `type: 'danger'` switches the confirm button and
 * icon to the destructive accent and promotes the host role to `alertdialog`
 * so assistive tech interrupts the user before the destructive action.
 *
 * @example
 * // Neutral confirmation.
 * dialog.open<DialogResult, ConfirmDialogData>(ConfirmDialogComponent, {
 *   data: {
 *     title: 'Retry camera?',
 *     body: 'Allow camera access, then try again.',
 *     confirmLabel: 'Retry',
 *     dismissLabel: 'Dismiss',
 *   },
 * });
 *
 * @example
 * // Destructive confirmation.
 * dialog.open<DialogResult, ConfirmDialogData>(ConfirmDialogComponent, {
 *   data: {
 *     type: 'danger',
 *     icon: 'exclamation',
 *     title: 'Delete this video?',
 *     body: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     dismissLabel: 'Cancel',
 *   },
 * });
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [IconDirective],
  templateUrl: './confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog-panel',
    'aria-modal': 'true',
    '[attr.role]': "isDanger ? 'alertdialog' : 'dialog'",
    '[class.dialog-panel--danger]': 'isDanger',
    '[attr.aria-labelledby]': 'titleId',
    '[attr.aria-describedby]': 'data.body ? bodyId : null',
  },
})
export class ConfirmDialogComponent {
  readonly data: ConfirmDialogData = inject<ConfirmDialogData>(DIALOG_DATA);
  readonly titleId = `confirm-dialog-title-${crypto.randomUUID()}`;
  readonly bodyId = `confirm-dialog-body-${crypto.randomUUID()}`;
  readonly isDanger = this.data.type === 'danger';
  readonly #dialogRef = inject<DialogRef<DialogResult>>(DialogRef);

  confirm(): void {
    this.#dialogRef.close('confirm');
  }

  dismiss(): void {
    this.#dialogRef.close('dismiss');
  }
}
