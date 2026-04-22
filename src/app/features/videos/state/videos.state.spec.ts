import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';
import { Recording } from '@core/recorder';
import { VideosState } from './videos.state';

function configure(): Store {
  TestBed.configureTestingModule({ providers: [provideStore([VideosState])] });
  return TestBed.inject(Store);
}

function makeBlob(content = 'x'): Blob {
  return new Blob([content], { type: 'video/webm' });
}

describe('VideosState', () => {
  it('starts with an empty items array', () => {
    const store = configure();
    expect(store.selectSnapshot(VideosState.items)).toEqual([]);
  });

  it('prepends a SavedVideo when Recording.Completed fires', async () => {
    const store = configure();
    const blob = makeBlob();

    await firstValueFrom(store.dispatch(new Recording.Completed(blob, 5.0, 'video/webm', '720p')));

    const items = store.selectSnapshot(VideosState.items);
    expect(items).toHaveLength(1);
    const [first] = items;
    expect(first?.blob).toBe(blob);
    expect(first?.duration).toBe(5.0);
    expect(first?.mimeType).toBe('video/webm');
    expect(first?.resolution).toBe('720p');
    expect(typeof first?.id).toBe('string');
    expect(first?.id.length).toBeGreaterThan(0);
    expect(first?.recordedAt).toBeInstanceOf(Date);
  });

  it('orders newest first (prepend)', async () => {
    const store = configure();
    const firstBlob = makeBlob('first');
    const secondBlob = makeBlob('second');

    await firstValueFrom(
      store.dispatch(new Recording.Completed(firstBlob, 3.0, 'video/webm', '360p')),
    );
    await firstValueFrom(
      store.dispatch(new Recording.Completed(secondBlob, 7.5, 'video/webm', '1080p')),
    );

    const items = store.selectSnapshot(VideosState.items);
    expect(items).toHaveLength(2);
    expect(items[0]?.blob).toBe(secondBlob);
    expect(items[0]?.duration).toBe(7.5);
    expect(items[1]?.blob).toBe(firstBlob);
  });

  it('assigns unique ids across completions', async () => {
    const store = configure();

    await firstValueFrom(
      store.dispatch(new Recording.Completed(makeBlob('a'), 1.0, 'video/webm', '720p')),
    );
    await firstValueFrom(
      store.dispatch(new Recording.Completed(makeBlob('b'), 2.0, 'video/webm', '720p')),
    );

    const items = store.selectSnapshot(VideosState.items);
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });
});
