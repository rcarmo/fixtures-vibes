/**
 * Browser-side request control for scenarios that need a slow or failing write.
 * Matching is by what the page sends, never by runtime route names.
 */
import type { Page, Request } from '@playwright/test';

const bodyText = (req: Request) => req.postDataBuffer()?.toString('latin1') ?? '';

/** A write whose body contains `marker` (JSON or text bodies). */
export const bodyHas = (marker: string) => (req: Request) => bodyText(req).includes(marker);

/** A multipart upload naming `fileName`. WebKit omits file bytes from multipart bodies but keeps the part headers. */
export const uploadOf = (fileName: string) => (req: Request) =>
  /multipart\/form-data/i.test(req.headers()['content-type'] ?? '') && bodyText(req).includes(fileName);

/** Hold matching writes until `release()`; then pass them on, or answer with `fail`. */
export async function holdWrites(page: Page, match: (req: Request) => boolean, fail?: { status: number; error: string }) {
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  const state = { count: 0, release, armed: true, disarm: () => { state.armed = false; } };
  await page.route('**/*', async route => {
    const req = route.request();
    if (!state.armed || req.method() === 'GET' || !match(req)) return route.fallback();
    state.count++;
    await held;
    if (fail) return route.fulfill({ status: fail.status, contentType: 'application/json', body: JSON.stringify({ error: fail.error }) });
    return route.fallback();
  });
  return state;
}

/**
 * Fail the first write to an endpoint the page has not written to before `arm()`.
 * Background writes (presence, visibility) repeat their endpoints, so the first new one is the user action.
 */
export async function failNextNewWrite(page: Page, fail: { status: number; error: string }) {
  const seen = new Set<string>();
  let armed = false;
  const state = { failed: null as string | null, arm: () => { armed = true; state.failed = null; } };
  await page.route('**/*', route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fallback();
    const key = `${req.method()} ${new URL(req.url()).pathname}`;
    if (!armed || state.failed || seen.has(key)) { if (!armed) seen.add(key); return route.fallback(); }
    state.failed = key;
    armed = false;
    return route.fulfill({ status: fail.status, contentType: 'application/json', body: JSON.stringify({ error: fail.error }) });
  });
  return state;
}

/** Hold matching GETs (e.g. one session's reads) until `release()`; they then reach the runtime late. */
export async function holdReads(page: Page, match: (req: Request) => boolean) {
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  const state = { count: 0, release };
  await page.route('**/*', async route => {
    const req = route.request();
    if (req.method() !== 'GET' || !match(req)) return route.fallback();
    state.count++;
    await held;
    return route.fallback().catch(() => {});
  });
  return state;
}

/**
 * Let a test drop the page's SSE connections. Call before navigation. `dropSse()` closes every open EventSource and
 * fires its `error` event, which is what the page sees when the network drops; the runtime's own reconnect logic
 * takes over from there. Returns how many connections were dropped.
 */
export async function installSseDrop(page: Page) {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    const open = new Set<EventSource>();
    class Tracked extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        open.add(this);
      }
    }
    (window as any).EventSource = Tracked;
    (window as any).__fixturesDropSse = () => {
      let dropped = 0;
      for (const source of open) {
        open.delete(source);
        if (source.readyState === Native.CLOSED) continue;
        source.close();
        source.dispatchEvent(new Event('error'));
        dropped++;
      }
      return dropped;
    };
  });
  return { drop: () => page.evaluate(() => (window as any).__fixturesDropSse() as number) };
}


/**
 * Keep the page offline for event streams: while blocked, new EventSource connections fail (the page's own
 * reconnect attempts keep failing). Pair with installSseDrop to cut the open ones.
 */
export async function blockSse(page: Page) {
  const state = { blocked: false, attempts: 0 };
  await page.route('**/*', route => {
    const req = route.request();
    if (!/event-stream/.test(req.headers()['accept'] ?? '')) return route.fallback();
    if (!state.blocked) return route.fallback();
    state.attempts++;
    return route.abort('internetdisconnected');
  });
  return { block: () => { state.blocked = true; state.attempts = 0; }, unblock: () => { state.blocked = false; }, get attempts() { return state.attempts; } };
}
