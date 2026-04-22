import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';
import { Bandwidth, BandwidthError, BandwidthErrorKind } from '@core/bandwidth';
import { QualityState } from './quality.state';

function configure(): Store {
  TestBed.configureTestingModule({
    providers: [provideStore([QualityState])],
  });
  return TestBed.inject(Store);
}

describe('QualityState', () => {
  it('defaults to medium tier with auto source', () => {
    const store = configure();

    expect(store.selectSnapshot(QualityState.tier)).toBe('medium');
    expect(store.selectSnapshot(QualityState.source)).toBe('auto');
  });

  it('Bandwidth.MeasurementCompleted("low") patches tier: low, source: auto', async () => {
    const store = configure();

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementCompleted(1, 'low')));

    expect(store.selectSnapshot(QualityState.tier)).toBe('low');
    expect(store.selectSnapshot(QualityState.source)).toBe('auto');
  });

  it('Bandwidth.MeasurementCompleted("high") patches tier: high, source: auto', async () => {
    const store = configure();

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementCompleted(10, 'high')));

    expect(store.selectSnapshot(QualityState.tier)).toBe('high');
    expect(store.selectSnapshot(QualityState.source)).toBe('auto');
  });

  it('Bandwidth.MeasurementFailed forces tier back to medium with auto source', async () => {
    const store = configure();
    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementCompleted(10, 'high')));

    const err = new BandwidthError(BandwidthErrorKind.ProbeFailed, 'nope');
    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementFailed(err)));

    expect(store.selectSnapshot(QualityState.tier)).toBe('medium');
    expect(store.selectSnapshot(QualityState.source)).toBe('auto');
  });

  it('exposes a profile selector that resolves to the current tier profile', async () => {
    const store = configure();

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementCompleted(0.5, 'low')));

    expect(store.selectSnapshot(QualityState.profile)).toMatchObject({
      tier: 'low',
      width: 640,
      height: 360,
    });
  });
});
