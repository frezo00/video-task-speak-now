import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { SavedVideo } from '@core/storage';

export type DeleteConfirmResult = 'confirm' | 'dismiss';

export interface DeleteConfirmDialogData {
  readonly video: SavedVideo;
}

/**
 * Destructive-action confirmation dialog for deleting a saved recording.
 *
 * Uses `role="alertdialog"` (not `"dialog"`) since it interrupts the user to
 * gate a destructive action. Cancel is first in the DOM so CDK's `autoFocus`
 * lands on the safe option.
 *
 * @example
 * dialog.open<DeleteConfirmResult, DeleteConfirmDialogData>(
 *   DeleteConfirmDialogComponent,
 *   { data: { video } },
 * );
 */
@Component({
  selector: 'app-delete-confirm-dialog',
  templateUrl: './delete-confirm-dialog.component.html',
  styleUrl: './delete-confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog-panel dialog-panel--danger',
    role: 'alertdialog',
    'aria-modal': 'true',
    '[attr.aria-labelledby]': 'titleId',
    '[attr.aria-describedby]': 'bodyId',
  },
})
export class DeleteConfirmDialogComponent {
  readonly data: DeleteConfirmDialogData = inject<DeleteConfirmDialogData>(DIALOG_DATA);
  readonly titleId = `delete-confirm-title-${crypto.randomUUID()}`;
  readonly bodyId = `delete-confirm-body-${crypto.randomUUID()}`;
  readonly #dialogRef = inject<DialogRef<DeleteConfirmResult>>(DialogRef);

  confirm(): void {
    this.#dialogRef.close('confirm');
  }

  dismiss(): void {
    this.#dialogRef.close('dismiss');
  }
}
