import type { ApplicationConfig } from '@angular/core';
import {
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { provideStore } from '@ngxs/store';
import { BandwidthState } from '@core/bandwidth';
import { QualityState } from '@features/recorder';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideStore(
      [BandwidthState, QualityState],
      withNgxsReduxDevtoolsPlugin({ disabled: !isDevMode() }),
    ),
  ],
};
