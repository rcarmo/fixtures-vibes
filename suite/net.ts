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
