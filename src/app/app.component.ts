import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RecorderPageComponent } from '@features/recorder';
import { ErrorBannerComponent } from '@shared/error-banner';

@Component({
  selector: 'app-root',
  imports: [RecorderPageComponent, ErrorBannerComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-shell',
  },
})
export class AppComponent {}
