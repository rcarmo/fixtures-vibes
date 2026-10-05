/** Classic session picker (sessions/session-switching.feature @ux-session-002..004, 006). */
import type { Page } from '@playwright/test';
import { entries, sessionList, nameRe, searchField, highlighted } from '../pickers';
import { test, expect } from '../fixtures';
import { failNextNewWrite } from '../net';
import { randomUUID } from 'node:crypto';

const tag = () => randomUUID().replace(/-/g, '').slice(0, 8);
const trigger = (page: Page) => page.getByRole('button', { name: /manage sessions/i }).first();
const search = (page: Page) => searchField(page, /search sessions/i);
const openPicker = async (page: Page, query?: string) => {
  await trigger(page).click();
  await expect(search(page)).toBeVisible();
  if (query !== undefined) await search(page).fill(query);
};
/** Accessible names of the picker's entries, in display order. */
const order = (page: Page) => entries(sessionList(page)).evaluateAll(es => es.map(e => e.getAttribute('aria-label') || e.textContent || ''));

test('@ux-session-002 Group picker entries using the current session metadata', async ({ page, runtime }) => {
  const n = tag();
  // Names sort current < other < pinned alphabetically, so grouping must reorder them.
  const current = await runtime.newSession(`ga${n}`);
  await runtime.newSession(`gb${n}`);
  const pinned = `gz${n}`;
  await runtime.newSession(pinned);
  await page.goto(current.url);
  const pin = (verb: string) => page.getByRole('button', { name: new RegExp(`^${verb}\\b.*${nameRe(pinned).source}`) });
  await openPicker(page);
  await pin('Pin').click();
  await expect(pin('Unpin')).toBeVisible();
  try {
    await page.reload();
    await openPicker(page);
    const names = await order(page);
    const at = (name: string) => names.findIndex(x => nameRe(name).test(x));
    expect(at(`ga${n}`)).toBeGreaterThanOrEqual(0);
    expect(at(pinned)).toBeGreaterThan(at(`ga${n}`));
    expect(at(pinned)).toBeLessThan(at(`gb${n}`));
    // The current session stays distinguishable: selected or marked current.
    const cur = entries(sessionList(page), nameRe(`ga${n}`)).first();
    const marked = await cur.evaluate(e => e.getAttribute('aria-selected') === 'true' || e.getAttribute('aria-current') != null
      || /\bcurrent\b/i.test(`${e.getAttribute('aria-label')} ${e.textContent}`));
    expect(marked).toBe(true);
    for (const other of [pinned, `gb${n}`]) {
      const e = entries(sessionList(page), nameRe(other)).first();
      expect(await e.evaluate(x => /\bcurrent\b/i.test(`${x.getAttribute('aria-label')} ${x.textContent}`))).toBe(false);
    }
  } finally {
    if (!(await search(page).isVisible())) await openPicker(page);
    if (await pin('Unpin').count()) await pin('Unpin').click();
  }
});

test('@ux-session-003 Filter session entries using their search metadata', async ({ page, runtime, sel }) => {
  const n = tag();
  const current = await runtime.newSession(`fa${n}`);
  await runtime.newSession(`fq${n}one`);
  await runtime.newSession(`fq${n}two`);
  await page.goto(current.url);
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  await expect(search(page)).toBeFocused();
  await page.keyboard.type(`fq${n}`);
  const list = sessionList(page);
  await expect(entries(list)).toHaveCount(2);
  await expect(entries(list, nameRe(`fa${n}`))).toHaveCount(0);
  // Arrow keys move through the filtered list only; Enter opens the highlighted entry.
  const seen = new Set<string>();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown');
    const h = highlighted(list, sel);
    const label = await h.first().evaluate(e => e.getAttribute('aria-label') || e.textContent || '').catch(() => '');
    expect(label).toMatch(new RegExp(`fq${n}(one|two)`));
    seen.add(/one/.test(label.split(`fq${n}`)[1] ?? '') ? 'one' : 'two');
  }
  expect([...seen].sort()).toEqual(['one', 'two']);
  await page.keyboard.press('ArrowDown');
  const h = highlighted(list, sel).first();
  const target = /fq\w+?(one|two)/.exec(await h.evaluate(e => e.getAttribute('aria-label') || e.textContent || ''))![1];
  await page.keyboard.press('Enter');
  await expect(trigger(page)).toHaveAccessibleName(nameRe(`fq${n}${target}`));
});

test('@ux-session-004 Use archive and restore actions supplied for session entries', async ({ page, runtime }) => {
  const n = tag();
  const home = await runtime.newSession(`ah${n}`);
  const name = `ar${n}`;
  const victim = await runtime.newSession(name);
  await runtime.sessionHeadroom();
  page.on('dialog', d => void d.accept().catch(() => {}));
  await page.goto(victim.url);
  await openPicker(page);
  const archive = page.getByRole('button', { name: /^(archive|delete) current/i });
  test.skip(!(await archive.count()), 'no archive action supplied for this entry');
  await archive.click();
  // Accepted: the session leaves the active catalogue and is listed as archived after the refresh.
  await expect(trigger(page)).not.toHaveAccessibleName(nameRe(name));
  await page.goto(home.url);
  await openPicker(page, name);
  const entry = entries(sessionList(page), nameRe(name)).first();
  await expect(entry).toHaveAccessibleName(/archived/i);

  // A failed restore reports the error and leaves the entry archived.
  await page.keyboard.press('Escape');
  const fail = await failNextNewWrite(page, { status: 500, error: `restore-${n}` });
  await openPicker(page, name);
  fail.arm();
  await entry.click();
  await expect.poll(() => fail.failed).not.toBeNull();
  await expect(page.getByText(/could not restore|restore failed|failed to restore/i).or(page.getByText(`restore-${n}`)).first()).toBeVisible();
  await expect(trigger(page)).toHaveAccessibleName(nameRe(`ah${n}`));

  // Restore succeeds and opens the session; the catalogue no longer lists it as archived.
  if (!(await search(page).isVisible())) await openPicker(page, name);
  await entries(sessionList(page), nameRe(name)).first().click();
  await expect(trigger(page)).toHaveAccessibleName(nameRe(name));
  await page.reload();
  await openPicker(page, name);
  await expect(entries(sessionList(page), nameRe(name)).first()).not.toHaveAccessibleName(/archived/i);
});

test('@ux-session-006 Dismiss the session picker without choosing an entry', async ({ page, runtime }) => {
  const n = tag();
  const current = await runtime.newSession(`da${n}`);
  await runtime.newSession(`db${n}`);
  await page.goto(current.url);
  const url = page.url();
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  await expect(search(page)).toBeFocused();
  await page.keyboard.type(`db${n}`);
  await expect(entries(sessionList(page))).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(sessionList(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  await expect(trigger(page)).toHaveAccessibleName(nameRe(`da${n}`));
  await trigger(page).click();
  await expect(search(page)).toHaveValue('');
  await expect(entries(sessionList(page), nameRe(`da${n}`))).toHaveCount(1);
});
