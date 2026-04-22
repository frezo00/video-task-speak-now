import { ErrorBannerService } from './error-banner.service';

describe('ErrorBannerService', () => {
  let service: ErrorBannerService;

  beforeEach(() => {
    service = new ErrorBannerService();
  });

  it('starts with an empty queue', () => {
    expect(service.$items()).toEqual([]);
  });

  it('push appends an item with a generated id and returns it', () => {
    const id = service.push({ level: 'warning', message: 'hello' });

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(service.$items()).toHaveLength(1);
    expect(service.$items()[0]).toMatchObject({
      id,
      level: 'warning',
      message: 'hello',
    });
  });

  it('push allocates distinct ids for repeated pushes', () => {
    const a = service.push({ level: 'info', message: 'a' });
    const b = service.push({ level: 'info', message: 'b' });

    expect(a).not.toBe(b);
    expect(service.$items()).toHaveLength(2);
  });

  it('dismiss removes the matching item without affecting others', () => {
    const a = service.push({ level: 'info', message: 'a' });
    service.push({ level: 'error', message: 'b' });

    service.dismiss(a);

    expect(service.$items()).toHaveLength(1);
    expect(service.$items()[0]?.message).toBe('b');
  });

  it('dismiss with an unknown id is a no-op', () => {
    service.push({ level: 'info', message: 'only' });

    service.dismiss('nope');

    expect(service.$items()).toHaveLength(1);
  });

  it('clear empties the queue', () => {
    service.push({ level: 'info', message: 'a' });
    service.push({ level: 'warning', message: 'b' });

    service.clear();

    expect(service.$items()).toEqual([]);
  });
});
