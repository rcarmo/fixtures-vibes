/** Quick Actions command insertion (features/classic/canonical/canonical-ux.feature). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

async function openQuickActions(page: Page, sel: (k: string) => string, query: string) {
  await page.locator(sel('composeInput')).fill('existing text');
  await page.locator(sel('timeline')).click({ position: { x: 40, y: 40 } });
  await page.keyboard.type(query);
  const box = page.getByRole('textbox', { name: /slash command/i });
  await expect(box).toBeVisible();
  return box;
}

async function expectPrefilled(page: Page, sel: (k: string) => string, command: string, posts: number, box: ReturnType<Page['locator']>) {
  const input = page.locator(sel('composeInput'));
  await expect(input).toHaveValue(command);
  await expect(input).toBeFocused();
  expect(await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([command.length, command.length]);
  await expect(box).toBeHidden();
  await page.waitForTimeout(800);
  expect(await page.locator(sel('timelinePost')).count()).toBe(posts);
}

test('@ux-original-007 Insert a Quick Actions command into the composer', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const posts = await page.locator(sel('timelinePost')).count();
  const box = await openQuickActions(page, sel, '/');
  const option = page.getByRole('button', { name: /^\/(?!skill:)[a-z-]+ Insert/ }).first();
  const command = ((await option.textContent()) ?? '').match(/\/[a-z][a-z-]*/)![0];
  await option.click();
  await expectPrefilled(page, sel, command, posts, box);
});

test('@ux-original-008 Discover loaded skills in the command catalogue', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const posts = await page.locator(sel('timelinePost')).count();
  const box = await openQuickActions(page, sel, '/skill:');
  const skills = page.getByRole('button', { name: /^\/skill:[\w-]+ Insert/ });
  test.skip((await skills.count()) === 0, 'environment-limit: no skills loaded in this runtime instance');
  // Skills live in the Slash commands group; Quick Actions creates no separate Skills group.
  await expect(page.getByText('Slash commands', { exact: true })).toBeVisible();
  await expect(page.getByText('Skills', { exact: true })).toHaveCount(0);
  const option = skills.first();
  const command = ((await option.textContent()) ?? '').match(/\/skill:[a-z0-9-]+/)![0];
  await option.click();
  await expectPrefilled(page, sel, command, posts, box);
});

test('@ux-shared-008 Discover loaded skills through canonical slash commands', async ({ page, runtime, sel }) => {
  const n = Math.random().toString(36).slice(2, 10);
  await page.goto((await runtime.newSession()).url);
  const posts = await page.locator(sel('timelinePost')).count();
  let box = await openQuickActions(page, sel, '/skill:');
  const skills = page.getByRole('button', { name: /^\/skill:[\w-]+ Insert/ });
  test.skip((await skills.count()) < 2, 'environment-limit: fewer than two skills loaded in this runtime instance');
  const labels = await skills.evaluateAll(els => els.map(e => e.getAttribute('aria-label') ?? (e as HTMLElement).innerText));
  const names = labels.map(l => l.match(/\/skill:[a-z0-9-]+/)![0]);
  expect(new Set(names).size, 'each loaded skill appears exactly once').toBe(names.length);
  await expect(page.getByText('Slash commands', { exact: true })).toBeVisible();
  await expect(page.getByText('Skills', { exact: true })).toHaveCount(0);

  // Search by description: a word from one skill's description that is not in its name and is rare across the list.
  const words = (l: string) => l.toLowerCase().replace(/\/skill:[a-z0-9-]+/, '').match(/[a-z]{7,}/g) ?? [];
  let pick: { name: string; word: string } | undefined;
  for (const [i, l] of labels.entries()) {
    const w = words(l).find(w => !names[i].includes(w) && labels.filter(o => o.toLowerCase().includes(w)).length === 1);
    if (w) { pick = { name: names[i], word: w }; break; }
  }
  expect(pick, 'some skill has a distinctive description word').toBeTruthy();
  await box.fill(pick!.word);
  const visible = page.getByRole('button', { name: /^\/skill:[\w-]+ Insert/ });
  await expect(visible).toHaveCount(1);
  await expect(visible.first()).toHaveAccessibleName(new RegExp(`^${pick!.name.replace('/', '\\/')} `));
  await page.keyboard.press('Escape');

  // Activation replaces the composer text with exactly the command and does not submit (@ux-original-007).
  box = await openQuickActions(page, sel, pick!.name);
  await page.getByRole('button', { name: new RegExp(`^${pick!.name.replace('/', '\\/')} Insert`) }).click();
  await expectPrefilled(page, sel, pick!.name, posts, box);

  // Execution expands only that skill.
  const input = page.locator(sel('composeInput'));
  await input.fill(`${pick!.name} [reply:skill-${n}] run ${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `skill-${n}` })).toHaveCount(1);
  const turn = (await runtime.modelLog()).filter(e => e.prompt.includes(`run ${n}`));
  expect(turn).toHaveLength(1);
  expect(turn[0].skills).toEqual([pick!.name.slice('/skill:'.length)]);

  // An unknown skill fails visibly (inline or as a dialog), invokes no model turn and loses nothing: the command is
  // either restored to the composer (rejected before sending) or kept in the timeline (Piclaw 3.2.5).
  const draft = `/skill:missing-${n} [reply:none-${n}] run ${n}b`;
  const unknown = new RegExp(`unknown skill.*missing-${n}`, 'i');
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.message()); void d.accept().catch(() => {}); });
  await input.fill(draft);
  await input.press('Enter');
  await expect.poll(async () => dialogs.some(m => unknown.test(m)) || (await page.getByText(unknown).count()) > 0,
    { message: 'unknown-skill failure shown' }).toBe(true);
  await expect.poll(async () => (await input.inputValue()) === draft
    || (await page.locator(sel('timeline')).getByText(new RegExp(`skill:missing-${n}`)).count()) > 0,
    { message: 'rejected command kept in the composer or the timeline' }).toBe(true);
  await page.waitForTimeout(1000);
  expect((await runtime.modelLog()).filter(e => JSON.stringify(e).includes(`missing-${n}`) || e.prompt.includes(`${n}b`))).toHaveLength(0);
  await expect(input).toBeEditable();
});
