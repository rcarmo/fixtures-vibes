/** Composer submission (features/classic/compose/instant-visibility.feature @ux-compose-007..011). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { holdWrites, bodyHas } from '../net';
import { uploadFile, pane, treeRow, removeFiles, openWorkspace, uncover, rowOf } from '../workspace';
import { randomUUID } from 'node:crypto';
import type { Page, Request } from '@playwright/test';

const tag = () => randomUUID().replace(/-/g, '').slice(0, 8);
const writes = (page: Page) => {
  const seen: Request[] = [];
  page.on('request', r => { if (r.method() !== 'GET') seen.push(r); });
  return seen;
};

test('@ux-compose-007 Display an accepted text submission', async ({ page, runtime, sel }) => {
  const n = tag();
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:ok-${n}] hello ${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('userPost')).filter({ hasText: `hello ${n}` })).toHaveCount(1);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
  // The displayed message is the stored one: it is still there, once, after a reload.
  await page.reload();
  await expect(page.locator(sel('userPost')).filter({ hasText: `hello ${n}` })).toHaveCount(1);
});

test('@ux-compose-008 Serialize text and references into one submission', async ({ page, runtime, sel }) => {
  test.setTimeout(90_000);
  const n = tag();
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  const box = page.locator(sel('composeBox'));
  await input.fill(`[reply:seed-${n}] seed`);
  await input.press('Enter');
  const seed = page.locator(sel('agentPost')).filter({ hasText: `seed-${n}` });
  await expect(seed).toHaveCount(1);
  const file = await uploadFile(page, `ref-${n}`);
  try {
    // A file and a folder from the workspace pane, and a message from its timestamp link.
    await (await rowOf(page, file)).click();
    await expect(box).toContainText(file);
    // Folder actions may be revealed on hover, so list them from the markup.
    const folder = (await pane(page).locator('button').evaluateAll(es => es.map(e => e.getAttribute('aria-label') || e.getAttribute('title') || '')))
      .filter(l => /^add folder hint for /i.test(l)).map(l => l.replace(/^add folder hint for /i, '')).find(f => f && f !== '.')!;
    await (await treeRow(page, folder))!.hover();
    await pane(page).getByRole('button', { name: new RegExp(`^add folder hint for ${folder}$`, 'i') }).click();
    await expect(box).toContainText(folder);
    const before = await box.innerText();
    // On narrow layouts the workspace pane covers the timeline.
    await uncover(page, seed.getByRole('link').first());
    await seed.getByRole('link').first().click();
    await expect.poll(async () => (await box.innerText()).length).toBeGreaterThan(before.length);
    // The reference carries the message's canonical ID, which its timestamp link (or the post itself) points at; the
    // composer label is free to show something else, such as a row number.
    const link = seed.getByRole('link').first();
    const messageId = /(\d+)\D*$/.exec(await link.getAttribute('href') ?? '')?.[1]
      ?? /(\d+)\D*$/.exec(await seed.getAttribute('id') ?? '')?.[1];
    expect(messageId).toBeTruthy();

    const sent = writes(page);
    await input.fill(`  line one ${n}\n  line two [reply:refs-${n}]  \n`);
    await input.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `refs-${n}` })).toHaveCount(1);
    const body = sent.map(r => r.postData() ?? '').find(b => b.includes(`refs-${n}`))!;
    const content = JSON.stringify(JSON.parse(body)); // one encoding for the checks below
    // Trimmed text with its inner line structure, then the reference blocks, in one submission.
    expect(content).toContain(`line one ${n}\\n  line two [reply:refs-${n}]`);
    expect(content).not.toContain(`  line one ${n}`);
    for (const ref of [file, folder, messageId!]) expect(content).toContain(ref);
    expect(sent.filter(r => (r.postData() ?? '').includes(`refs-${n}`))).toHaveLength(1);

    // References alone make a non-empty submission.
    await openWorkspace(page);
    await (await rowOf(page, file)).click();
    await expect(box).toContainText(file);
    await expect(input).toHaveValue('');
    const posts = await page.locator(sel('userPost')).count();
    // Enter in the empty composer (on narrow layouts the workspace drawer still covers the Send button).
    await input.press('Enter');
    await expect(page.locator(sel('userPost'))).toHaveCount(posts + 1);
    await expect(page.locator(sel('userPost')).last()).toContainText(file);
  } finally {
    await removeFiles(page, [file]);
  }
});

test('@ux-compose-009 Preserve the association between uploaded files and media identifiers', async ({ page, runtime, sel }) => {
  const n = tag();
  await page.goto((await runtime.newSession()).url);
  const files = ['a', 'b', 'c'].map(k => ({ name: `${k}-${n}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`${k}-body-${n}\n`) }));
  await page.locator(sel('composeBox')).locator('input[type=file]').setInputFiles(files);
  await page.locator(sel('composeInput')).fill(`[reply:ok-${n}] files ${n}`);
  await page.locator(sel('composeInput')).press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
  await page.reload();
  const post = page.locator(sel('userPost')).filter({ hasText: `files ${n}` });
  await expect(post).toHaveCount(1);
  // Each stored attachment is reachable under its own filename and serves that file.
  const hrefs = new Set<string>();
  for (const f of files) {
    const link = post.getByRole('link', { name: f.name }).first();
    await expect(link).toBeVisible();
    const href = (await link.getAttribute('href'))!;
    hrefs.add(href);
    const res = await page.request.get(new URL(href, page.url()).href);
    expect(res.ok()).toBe(true);
    // Playwright's WebKit on Linux uploads files without their bytes; their content cannot be compared there.
    if (page.context().browser()?.browserType().name() !== 'webkit') expect(await res.text()).toBe(f.buffer.toString());
  }
  expect(hrefs.size).toBe(files.length);
});

test('@ux-compose-010 Do not erase newer typing after send completes', async ({ page, runtime, sel }) => {
  const n = tag();
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  const send = await holdWrites(page, bodyHas(`first-${n}`));
  await input.fill(`[reply:ok-${n}] first-${n}`);
  await input.press('Enter');
  await expect.poll(() => send.count).toBe(1);
  await expect(input).toHaveValue('');
  await input.fill(`newer ${n}`);
  send.release();
  await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(input).toHaveValue(`newer ${n}`);
});

test('@ux-compose-011 Reconcile visible messages through timeline state', async ({ page, runtime, sel }) => {
  const n = tag();
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  const timeline = page.locator(sel('timeline'));
  // Enough history to scroll.
  const tall = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\\n');
  for (const k of [1, 2]) {
    await input.fill(`[reply:${tall}\\nend-${k}-${n}] fill ${k}`);
    await input.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `end-${k}-${n}` })).toHaveCount(1);
  }
  // Positions are measured from layout, so scroll direction (e.g. a bottom-pinned column-reverse list) does not matter.
  const posts = page.locator(sel('timelinePost'));
  const view = () => timeline.boundingBox().then(b => b!);
  const lastGap = async () => (await posts.last().boundingBox())!.y + (await posts.last().boundingBox())!.height - ((await view()).y + (await view()).height);
  const anchor = page.locator(sel('agentPost')).filter({ hasText: `end-1-${n}` });
  // Wheel where the device has one; otherwise (touch WebKit) scroll the timeline's scroll container directly.
  const scrollBy = async (dy: number) => {
    const v = await view();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
    const wheel = await page.mouse.wheel(0, dy).then(() => true, () => false);
    if (!wheel) await anchor.evaluate((el, d) => {
      let e: HTMLElement | null = el.parentElement;
      while (e && !(e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement;
      e?.scrollBy({ top: d });
    }, dy);
    await page.waitForTimeout(400);
  };
  // Near the bottom, a reply stays in view.
  await expect.poll(lastGap).toBeLessThan(80);
  const gate = gateName('scroll');
  await input.fill(`[gate:${gate}][reply:${tall}\\nlate-${n}] late`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  // Reading history: the user scrolls up by wheel; the reply then arrives without moving what they are reading.
  await scrollBy(-2400);
  await page.waitForTimeout(600);
  const y = (await anchor.boundingBox())?.y;
  expect(y).toBeDefined();
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `late-${n}` })).toHaveCount(1);
  await page.waitForTimeout(800);
  expect(Math.abs((await anchor.boundingBox())!.y - y!)).toBeLessThan(40);
  expect(await lastGap()).toBeGreaterThan(200);
  // Back at the bottom, the next reply is followed.
  for (let i = 0; i < 20 && (await lastGap()) > 40; i++) await scrollBy(1200);
  await input.fill(`[reply:${tall}\\nfollow-${n}] follow`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `follow-${n}` })).toHaveCount(1);
  await expect.poll(lastGap).toBeLessThan(80);
});
