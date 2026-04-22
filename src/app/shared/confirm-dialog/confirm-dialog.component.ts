import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

export type DialogResult = 'confirm' | 'dismiss';

export interface ConfirmDialogData {
  readonly title: string;
  readonly body: readonly string[];
  readonly confirmLabel: string;
  readonly dismissLabel: string;
}

/**
 * Generic confirmation dialog rendered through CDK `Dialog`.
 *
 * Open it with typed data and consume the `'confirm' | 'dismiss'` result
 * from `DialogRef.closed`.
 *
 * @example
 * dialog.open<DialogResult, ConfirmDialogData>(ConfirmDialogComponent, {
 *   data: {
 *     title: 'Delete video?',
 *     body: ['This cannot be undone.'],
 *     confirmLabel: 'Delete',
 *     dismissLabel: 'Cancel',
 *   },
 * });
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog-panel',
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-labelledby]': 'titleId',
  },
})
export class ConfirmDialogComponent {
  readonly data: ConfirmDialogData = inject<ConfirmDialogData>(DIALOG_DATA);
  readonly titleId = `confirm-dialog-title-${crypto.randomUUID()}`;
  readonly #dialogRef = inject<DialogRef<DialogResult>>(DialogRef);

  confirm(): void {
    this.#dialogRef.close('confirm');
  }

  dismiss(): void {
    this.#dialogRef.close('dismiss');
  }
}
