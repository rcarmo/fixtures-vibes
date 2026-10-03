/** Classic side-question (BTW) panel (features/classic/canonical/core-interactions.feature @ux-extra-001). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const panel = (page: Page) => page.getByLabel(/side conversation|btw/i).filter({ visible: true }).first();
const ask = async (page: Page, sel: Sel, question: string) => {
  await page.locator(sel('composeInput')).fill(`/btw ${question}`);
  await page.locator(sel('composeInput')).press('Enter');
  await expect(panel(page)).toBeVisible();
};
const button = (page: Page, name: RegExp) => panel(page).getByRole('button', { name });

test('@ux-extra-001 Display and act on a side-question result', async ({ page, runtime, sel }) => {
  test.setTimeout(90_000);
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);

  // Running: the question shows; no answer and no Retry/Inject footer yet.
  const gate = gateName('btw');
  // The answer carries emphasis markup, so the raw question text never contains the rendered answer.
  await ask(page, sel, `[gate:${gate}][reply:an*swer*-${n}] what is ${n}?`);
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  await expect(panel(page)).toContainText(`what is ${n}?`);
  await expect(panel(page)).not.toContainText(`answer-${n}`);
  await expect(button(page, /^retry$/i)).toHaveCount(0);
  await expect(button(page, /^inject into chat$/i)).toHaveCount(0);

  // Completed: the answer and both actions.
  await runtime.openGate(gate);
  await expect(panel(page)).toContainText(`answer-${n}`);
  await expect(button(page, /^retry$/i)).toBeEnabled();
  await expect(button(page, /^inject into chat$/i)).toBeEnabled();

  // Retry asks the same question again.
  const before = (await runtime.modelLog()).length;
  await button(page, /^retry$/i).click();
  await expect.poll(async () => (await runtime.modelLog()).slice(before).some(e => String(e.prompt).includes(`what is ${n}?`))).toBe(true);
  await expect(button(page, /^inject into chat$/i)).toBeEnabled({ timeout: 20_000 });

  // Inject into chat posts the question and answer to the chat.
  await button(page, /^inject into chat$/i).click();
  const injected = page.locator(sel('userPost')).filter({ hasText: `answer-${n}` });
  await expect(injected).toHaveCount(1);
  await expect(injected).toContainText(`what is ${n}?`);

  // An error: the error shows, Retry is available, Inject is disabled without an answer.
  await ask(page, sel, `[fail:400] fails ${n}?`);
  await expect(panel(page)).toContainText(`fails ${n}?`);
  await expect(button(page, /^retry$/i)).toBeEnabled({ timeout: 30_000 });
  await expect(panel(page)).toContainText(/error|400|fail/i);
  await expect(button(page, /^inject into chat$/i)).toBeDisabled();
});
