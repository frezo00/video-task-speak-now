import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconDirective } from './shared/icons';

@Component({
  selector: 'app-root',
  imports: [IconDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-shell',
  },
})
export class AppComponent {}
