import type { ApplicationConfig } from '@angular/core';
import {
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { provideStore, Store } from '@ngxs/store';
import { BandwidthState } from '@core/bandwidth';
import { ErrorBannerService } from '@core/error';
import { storageErrorMessage, VideoStorageService } from '@core/storage';
import { QualityState, RecorderState } from '@features/recorder';
import { Videos, VideosState } from '@features/videos';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideStore(
      [BandwidthState, QualityState, RecorderState, VideosState],
      withNgxsReduxDevtoolsPlugin({ disabled: !isDevMode() }),
    ),
    provideAppInitializer(() => {
      const storage = inject(VideoStorageService);
      const store = inject(Store);
      const banner = inject(ErrorBannerService);
      return storage
        .listAll()
        .then(({ items, skippedCount }) => {
          store.dispatch(new Videos.Hydrated(items, skippedCount));
        })
        .catch((err: unknown) => {
          banner.push({
            level: 'error',
            message: storageErrorMessage(err, "Couldn't load your saved recordings."),
          });
          console.error('[app] videos hydration failed', err);
        });
    }),
  ],
};
