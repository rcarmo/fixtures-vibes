/**
 * PWA manifest and icons (features/classic/mobile/pwa-manifest.feature), checked over public HTTP.
 * The reference runs without a configured agent avatar; avatar scenarios set one and always clear it again.
 */
import { test, expect } from '../fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import type { Runtime } from '../runtime';
import { deflateSync } from 'node:zlib';

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

/** A solid-colour RGB PNG, so each avatar is a distinct valid image. */
function solidPng(size: number, rgb: [number, number, number]): Buffer {
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array(size).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}

/** Sets the avatar through the profile's composer commands; always restore with `clear`. */
async function avatarControl(page: Page, runtime: Runtime, sel: (k: string) => string) {
  const { setAgentAvatar, clearAgentAvatar } = runtime.profile.commands ?? {};
  if (!setAgentAvatar || !clearAgentAvatar) throw new Error('@cap-agent-avatar requires commands.setAgentAvatar and commands.clearAgentAvatar');
  await page.goto((await runtime.newSession()).url);
  const icons = async () => (await (await page.request.get(new URL(
    (await page.locator('link[rel="manifest"]').first().getAttribute('href'))!, page.url()).toString())).json()).icons as any[];
  const run = async (text: string, before: string) => {
    const input = page.locator(sel('composeInput'));
    // Runtimes may rate-limit agent messages (Piclaw: 30/min, no Retry-After). On HTTP 429, wait out the window once.
    let limited = false;
    const on429 = (r: import('@playwright/test').Response) => { if (r.status() === 429 && r.request().method() !== 'GET') limited = true; };
    page.on('response', on429);
    await input.fill(text);
    await input.press('Enter');
    await page.waitForTimeout(1000);
    if (limited) {
      test.info().setTimeout(test.info().timeout + 75_000);
      await page.waitForTimeout(61_000);
      await input.fill(text);
      await input.press('Enter');
    }
    page.off('response', on429);
    await expect.poll(async () => JSON.stringify((await icons()).map(i => i.src)), { timeout: 15_000 }).not.toBe(before);
  };
  return {
    icons,
    set: async (rgb: [number, number, number]) =>
      run(setAgentAvatar.replace('{source}', `data:image/png;base64,${solidPng(64, rgb).toString('base64')}`), JSON.stringify((await icons()).map(i => i.src))),
    clear: async () => run(clearAgentAvatar, JSON.stringify((await icons()).map(i => i.src))),
  };
}

test('@ux-pwa-002 Use configured agent-avatar URLs for manifest icons', async ({ page, runtime, sel }) => {
  const avatar = await avatarControl(page, runtime, sel);
  const defaults = (await avatar.icons()).map(i => i.src).sort();
  try {
    await avatar.set([200, 30, 30]);
    const icons = await avatar.icons();
    expect(icons.map(i => i.src).filter(src => defaults.includes(src))).toEqual([]);
    expect(icons.map(i => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of icons) {
      const r = await page.request.get(new URL(icon.src, page.url()).toString());
      expect(r.headers()['content-type'], icon.src).toBe('image/png');
      const [w, h] = pngSize(await r.body()) ?? [0, 0];
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    }
  } finally {
    await avatar.clear();
  }
  expect((await avatar.icons()).map(i => i.src).sort()).toEqual(defaults);
});

/** Centre pixel of an icon as decoded by the browser (same-origin canvas read). */
const centrePixel = (page: Page, src: string) => page.evaluate(async url => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return Array.from(ctx.getImageData(img.naturalWidth >> 1, img.naturalHeight >> 1, 1, 1).data.slice(0, 3));
}, new URL(src, page.url()).toString());

// Resizing and colour management may shift channels slightly; 40/255 still separates red from blue.
const near = (rgb: number[], want: [number, number, number]) => rgb.every((v, i) => Math.abs(v - want[i]) <= 40);

test('@ux-pwa-006 Vary avatar icon cache URLs with the avatar version', async ({ page, runtime, sel }) => {
  const avatar = await avatarControl(page, runtime, sel);
  const red: [number, number, number] = [200, 30, 30], blue: [number, number, number] = [30, 30, 200];
  try {
    await avatar.set(red);
    const first = await avatar.icons();
    const firstPixel = await centrePixel(page, first.find(i => i.sizes === '192x192')!.src);
    expect(near(firstPixel, red), `first icon ${firstPixel}`).toBe(true);
    await avatar.set(blue);
    const second = await avatar.icons();
    expect(second.length).toBe(first.length);
    for (const icon of second) expect(first.map(i => i.src), icon.src).not.toContain(icon.src);
    const secondPixel = await centrePixel(page, second.find(i => i.sizes === '192x192')!.src);
    expect(near(secondPixel, blue), `second icon ${secondPixel}`).toBe(true);
  } finally {
    await avatar.clear();
  }
});
