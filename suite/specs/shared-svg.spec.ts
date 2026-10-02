/**
 * Model-generated SVG: @ux-shared-028 (safety, all runtimes) and @ux-shared-031 (image preview, @cap-svg-render).
 * The fixture model sends the fenced block; assertions only use the rendered page and its network requests.
 */
import { test, expect } from '../fixtures';
import { randomUUID } from 'node:crypto';

const fence = (svg: string) => `\`\`\`svg\\n${svg}\\n\`\`\``;

test('@ux-shared-028 Model-generated SVG cannot run code or fetch resources', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const session = await runtime.newSession();
  await page.goto(session.url);
  const probe = `/fixtures-probe-${n}.png`;
  const fetched: string[] = [];
  page.on('request', r => { if (r.url().includes(probe)) fetched.push(r.url()); });
  await page.evaluate(() => { (window as any).__svgPwned = 0; });

  const hostile = `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__svgPwned=1"><script>window.__svgPwned=2</script><image href="${runtime.baseUrl}${probe}" width="10" height="10"/></svg>`;
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:Hostile ${n} <b>raw-${n}</b>\\n\\n${fence(hostile)}] svg hostile ${n}`);
  await input.press('Enter');
  const post = page.locator(sel('agentPost')).filter({ hasText: `Hostile ${n}` });
  await expect(post).toHaveCount(1);
  await expect(post.getByText('__svgPwned', { exact: false }).first()).toBeVisible();
  await expect(post.locator('b', { hasText: `raw-${n}` })).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).__svgPwned)).toBe(0);
  expect(fetched).toEqual([]);
});

test('@ux-shared-031 Render safe model-generated SVG as an isolated image', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const session = await runtime.newSession();
  await page.goto(session.url);
  const safe = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20"><title>chart ${n}</title><rect width="40" height="20" fill="#3b82f6"/></svg>`;
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:Safe ${n}\\n\\n${fence(safe)}] svg safe ${n}`);
  await input.press('Enter');
  const post = page.locator(sel('agentPost')).filter({ hasText: `Safe ${n}` });
  await expect(post).toHaveCount(1);
  const img = post.getByRole('img', { name: new RegExp(`chart ${n}`) });
  await expect(img).toHaveCount(1);
  const fits = await img.evaluate(el => el.getBoundingClientRect().width <= (el.closest('.post')?.getBoundingClientRect().width ?? Infinity));
  expect(fits).toBe(true);
  await expect(post.locator('svg title', { hasText: `chart ${n}` })).toHaveCount(0);
  await expect(post.getByText('<rect', { exact: false }).first()).toBeAttached();
});

test('@ux-original-029 Render a safe fenced SVG as an isolated image and retain source', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  // A user-authored post exercises the Classic renderer directly.
  await input.fill('```svg\n<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><title>user chart ' + n + '</title><rect width="40" height="20" fill="#3b82f6"/></svg>\n```');
  await input.press('Enter');
  const safe = page.locator(sel('timelinePost')).filter({ has: page.getByRole('img', { name: `user chart ${n}` }) });
  await expect(safe).toHaveCount(1);
  await expect(safe.getByRole('img', { name: `user chart ${n}` })).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(safe.locator('svg title', { hasText: `user chart ${n}` })).toHaveCount(0);
  await expect(safe.getByText('<rect', { exact: false }).first()).toBeAttached();

  const probe = `/fixtures-probe-u${n}.png`;
  const fetched: string[] = [];
  page.on('request', r => { if (r.url().includes(probe)) fetched.push(r.url()); });
  await page.evaluate(() => { (window as any).__svgPwned = 0; });
  await input.fill('```svg\n<svg xmlns="http://www.w3.org/2000/svg" onload="window.__svgPwned=1"><title>bad ' + n + '</title><script>window.__svgPwned=2</script><image href="' + runtime.baseUrl + probe + '" width="9" height="9"/></svg>\n```');
  await input.press('Enter');
  const unsafe = page.locator(sel('timelinePost')).filter({ hasText: `bad ${n}` }).first();
  await expect(unsafe).toBeVisible();
  await expect(unsafe.getByText('__svgPwned', { exact: false }).first()).toBeVisible();
  await expect(unsafe.locator('img[src^="data:image/svg+xml"]')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).__svgPwned)).toBe(0);
  expect(fetched).toEqual([]);
});
