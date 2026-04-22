import { Injectable, signal } from '@angular/core';

export const ERROR_BANNER_LEVELS = [
  'info',
  'warning',
  'error',
] as const satisfies readonly string[];
export type ErrorBannerLevel = (typeof ERROR_BANNER_LEVELS)[number];

export interface ErrorBannerItem {
  readonly id: string;
  readonly level: ErrorBannerLevel;
  readonly message: string;
}

/**
 * Application-wide queue of dismissible banner messages. Components push items
 * with {@link push}; the host UI (e.g. `ErrorBannerComponent`) reads {@link $items}
 * and calls {@link dismiss} when the user closes one.
 */
@Injectable({ providedIn: 'root' })
export class ErrorBannerService {
  readonly #$items = signal<readonly ErrorBannerItem[]>([]);
  readonly $items = this.#$items.asReadonly();

  push(item: Omit<ErrorBannerItem, 'id'>): string {
    const id = crypto.randomUUID();
    this.#$items.update((items) => [...items, { ...item, id }]);
    return id;
  }

  dismiss(id: string): void {
    this.#$items.update((items) => items.filter((i) => i.id !== id));
  }

  clear(): void {
    this.#$items.set([]);
  }
}
