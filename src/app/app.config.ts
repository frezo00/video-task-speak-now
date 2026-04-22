import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideStore } from '@ngxs/store';
import { BandwidthState } from '@core/bandwidth';
import { QualityState } from '@features/recorder';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideStore([BandwidthState, QualityState]),
  ],
};
