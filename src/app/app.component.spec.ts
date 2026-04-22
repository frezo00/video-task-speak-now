import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngxs/store';
import { BandwidthState } from '@core/bandwidth';
import { QualityState } from '@features/recorder';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideStore([BandwidthState, QualityState])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
