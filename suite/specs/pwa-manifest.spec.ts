/**
 * PWA manifest and icons (features/classic/mobile/pwa-manifest.feature), checked over public HTTP.
 * The reference runs without a configured agent avatar, so static icon fallbacks are what it serves.
 */
import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/** Width/height from a PNG IHDR chunk, or null when the body is not a PNG. */
function pngSize(body: Buffer): [number, number] | null {
  if (body.length < 24 || body.readUInt32BE(0) !== 0x89504e47) return null;
  return [body.readUInt32BE(16), body.readUInt32BE(20)];
}

async function manifest(page: import('@playwright/test').Page, request: APIRequestContext, url: string) {
  await page.goto(url);
  const href = await page.locator('link[rel="manifest"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.ok()).toBe(true);
  return { json: await res.json(), base: page.url() };
}

test('@ux-pwa-001 Serve a manifest with declared application icons', async ({ page, request, runtime }) => {
  const { json, base } = await manifest(page, request, runtime.baseUrl + '/');
  expect(typeof json.name).toBe('string');
  expect(json.icons.length).toBeGreaterThan(0);
  for (const icon of json.icons) for (const k of ['src', 'sizes', 'type', 'purpose']) expect(icon[k], `${k} in ${JSON.stringify(icon)}`).toBeTruthy();
  const sizes = json.icons.map((i: any) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const icon of json.icons) {
    const r = await request.get(new URL(icon.src, base).toString());
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toMatch(/^image\//);
  }
});

test('@ux-pwa-003 Fall back to static icons without an avatar', async ({ page, request, runtime }) => {
  const { json, base } = await manifest(page, request, runtime.baseUrl + '/');
  test.skip(Boolean(json.piclaw_avatar), 'environment-limit: reference has an avatar configured');
  for (const icon of json.icons) {
    const r = await request.get(new URL(icon.src, base).toString());
    expect(r.ok(), icon.src).toBe(true);
    const [w, h] = pngSize(await r.body()) ?? [0, 0];
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
});

for (const [path, size] of [['/apple-touch-icon-180x180.png', 180], ['/apple-touch-icon-167x167.png', 167],
  ['/apple-touch-icon-152x152.png', 152], ['/apple-touch-icon.png', 180]] as const) {
  test(`@ux-pwa-004 Request sized Apple touch icons: ${path}`, async ({ request, runtime }) => {
    const r = await request.get(runtime.baseUrl + path);
    expect(r.ok()).toBe(true);
    expect(r.headers()['content-type']).toBe('image/png');
    expect(pngSize(await r.body())).toEqual([size, size]);
  });
}

test('@ux-pwa-005 Prefer PNG avatars for favicon compatibility', async ({ request, runtime }) => {
  const r = await request.get(runtime.baseUrl + '/favicon.ico');
  expect(r.ok()).toBe(true);
  expect(r.headers()['content-type']).toMatch(/^image\/(png|x-icon|vnd\.microsoft\.icon)$/);
  expect((await r.body()).length).toBeGreaterThan(0);
});
