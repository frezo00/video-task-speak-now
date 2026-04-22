import { TestBed } from '@angular/core/testing';
import { Actions, ofActionDispatched, provideStore, Store } from '@ngxs/store';
import { firstValueFrom, take } from 'rxjs';
import type { Mock } from 'vitest';
import { ErrorBannerService } from '@core/error';
import type { QualityTier } from '../models/quality-profile';
import { BandwidthError, BandwidthErrorKind } from '../models/bandwidth-error';
import { BandwidthService } from '../services/bandwidth.service';
import { Bandwidth } from './bandwidth.actions';
import { BandwidthState } from './bandwidth.state';

interface BandwidthServiceStub {
  readonly measure: Mock<() => Promise<number>>;
  readonly mapToQuality: Mock<(mbps: number) => QualityTier>;
}

function makeStub(): BandwidthServiceStub {
  return {
    measure: vi.fn<() => Promise<number>>(),
    mapToQuality: vi.fn<(mbps: number) => QualityTier>(),
  };
}

function configure(stub: BandwidthServiceStub): { store: Store; actions$: Actions } {
  TestBed.configureTestingModule({
    providers: [provideStore([BandwidthState]), { provide: BandwidthService, useValue: stub }],
  });
  return { store: TestBed.inject(Store), actions$: TestBed.inject(Actions) };
}

describe('BandwidthState', () => {
  let stub: BandwidthServiceStub;

  beforeEach(() => {
    stub = makeStub();
  });

  it('has idle defaults', () => {
    const { store } = configure(stub);

    expect(store.selectSnapshot(BandwidthState.status)).toBe('idle');
    expect(store.selectSnapshot(BandwidthState.mbps)).toBeNull();
    expect(store.selectSnapshot(BandwidthState.errorKind)).toBeNull();
  });

  it('happy path: status flows to ready and mbps is set', async () => {
    stub.measure.mockResolvedValueOnce(4.2);
    stub.mapToQuality.mockReturnValueOnce('medium');
    const { store } = configure(stub);

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementRequested()));

    expect(store.selectSnapshot(BandwidthState.status)).toBe('ready');
    expect(store.selectSnapshot(BandwidthState.mbps)).toBe(4.2);
    expect(store.selectSnapshot(BandwidthState.errorKind)).toBeNull();
  });

  it('happy path dispatches Bandwidth.MeasurementCompleted with the mapped quality', async () => {
    stub.measure.mockResolvedValueOnce(7.5);
    stub.mapToQuality.mockReturnValueOnce('high');
    const { store, actions$ } = configure(stub);

    const completed$ = firstValueFrom(
      actions$.pipe(ofActionDispatched(Bandwidth.MeasurementCompleted), take(1)),
    );
    store.dispatch(new Bandwidth.MeasurementRequested());

    await expect(completed$).resolves.toMatchObject({ mbps: 7.5, quality: 'high' });
  });

  it('failure path: status flows to failed with errorKind set', async () => {
    stub.measure.mockRejectedValueOnce(new BandwidthError(BandwidthErrorKind.ProbeFailed, 'boom'));
    const { store } = configure(stub);

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementRequested()));

    expect(store.selectSnapshot(BandwidthState.status)).toBe('failed');
    expect(store.selectSnapshot(BandwidthState.errorKind)).toBe(BandwidthErrorKind.ProbeFailed);
    expect(store.selectSnapshot(BandwidthState.mbps)).toBeNull();
  });

  it('failure path pushes a warning banner with the fallback copy', async () => {
    stub.measure.mockRejectedValueOnce(
      new BandwidthError(BandwidthErrorKind.ProbeTimedOut, 'slow'),
    );
    const { store } = configure(stub);
    const banner = TestBed.inject(ErrorBannerService);

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementRequested()));

    expect(banner.$items()).toHaveLength(1);
    expect(banner.$items()[0]?.level).toBe('warning');
    expect(banner.$items()[0]?.message).toContain('defaulting to Medium');
  });

  it('failure path dispatches Bandwidth.MeasurementFailed with the BandwidthError', async () => {
    const err = new BandwidthError(BandwidthErrorKind.ProbeFailed, 'nope');
    stub.measure.mockRejectedValueOnce(err);
    const { store, actions$ } = configure(stub);

    const failed$ = firstValueFrom(
      actions$.pipe(ofActionDispatched(Bandwidth.MeasurementFailed), take(1)),
    );
    store.dispatch(new Bandwidth.MeasurementRequested());

    await expect(failed$).resolves.toMatchObject({ error: err });
  });

  it('wraps non-BandwidthError rejections into a ProbeFailed BandwidthError', async () => {
    stub.measure.mockRejectedValueOnce(new Error('something else'));
    const { store } = configure(stub);

    await firstValueFrom(store.dispatch(new Bandwidth.MeasurementRequested()));

    expect(store.selectSnapshot(BandwidthState.errorKind)).toBe(BandwidthErrorKind.ProbeFailed);
  });

  it('status passes through "measuring" before resolving', async () => {
    let resolveMeasure: (value: number) => void = () => undefined;
    const measurePromise = new Promise<number>((resolve) => {
      resolveMeasure = resolve;
    });
    stub.measure.mockImplementationOnce(() => measurePromise);
    stub.mapToQuality.mockReturnValueOnce('medium');
    const { store } = configure(stub);

    const dispatchPromise = firstValueFrom(store.dispatch(new Bandwidth.MeasurementRequested()));
    expect(store.selectSnapshot(BandwidthState.status)).toBe('measuring');
    resolveMeasure(3);
    await dispatchPromise;
    expect(store.selectSnapshot(BandwidthState.status)).toBe('ready');
  });
});
