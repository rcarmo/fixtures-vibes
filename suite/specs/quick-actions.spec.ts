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
