import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RecorderPageComponent } from '@features/recorder';

@Component({
  selector: 'app-root',
  imports: [RecorderPageComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-shell',
  },
})
export class AppComponent {}
