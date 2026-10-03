/** Shared copy, delete and read-aloud contract (features/canonical/shared-ux.feature @ux-shared-024, 029). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { failNextNewWrite } from '../net';
import { recordClipboard } from '../clipboard';

const nonce = () => randomUUID().slice(0, 8);


for (const [id, name] of [
  ['@ux-shared-024', 'Copy and delete timeline messages through native actions'],
  ['@ux-original-024', 'Copy and delete messages using their actual controls'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = nonce();
  const clipboard = await recordClipboard(page);
  const fault = await failNextNewWrite(page, { status: 500, error: `delete-boom-${n}` });
  const other = await runtime.newSession();
  const main = await runtime.newSession();
  await page.goto(main.url);
  const input = page.locator(sel('composeInput'));
  const markdown = `**Bold ${n}** and \`a < b\``;
  const code = 'const x = 1 < 2;';
  await input.fill(`[reply:Agent ${n}\\n\\n\`\`\`js\\n${code}\\n\`\`\`] ${markdown}`);
  await input.press('Enter');
  const agent = page.locator(sel('agentPost')).filter({ hasText: `Agent ${n}` });
  await expect(agent).toHaveCount(1);
  const user = page.locator(sel('userPost')).filter({ hasText: `Bold ${n}` });

  for (const post of [user, agent]) {
    await post.hover();
    await expect(post.getByRole('button', { name: /^copy message$/i })).toHaveCount(1);
    await expect(post.getByRole('button', { name: /^delete message$/i })).toHaveCount(1);
  }
  await expect(agent.getByRole('button', { name: /^copy code$/i })).toHaveCount(1);

  // Copy gives the authored Markdown (not rendered HTML), shows success on the control, then returns to idle.
  await user.hover();
  await user.getByRole('button', { name: /^copy message$/i }).click();
  expect(await clipboard()).toEqual([`[reply:Agent ${n}\\n\\n\`\`\`js\\n${code}\\n\`\`\`] ${markdown}`]);
  await expect(user.getByRole('button', { name: /copied/i })).toHaveCount(1);
  await expect(user.getByRole('button', { name: /^copy message$/i })).toHaveCount(1, { timeout: 10_000 });
  await agent.getByRole('button', { name: /^copy code$/i }).click();
  expect((await clipboard()).map(t => t.trimEnd())).toEqual([code]);

  // A rejected delete keeps the message; an accepted one removes only that message.
  await input.fill(`draft ${n}`);
  fault.arm();
  await agent.hover();
  await agent.getByRole('button', { name: /^delete message$/i }).click();
  await expect.poll(() => fault.failed).not.toBeNull();
  await page.waitForTimeout(800);
  await expect(agent).toHaveCount(1);
  await agent.hover();
  await agent.getByRole('button', { name: /^delete message$/i }).click();
  await expect(agent).toHaveCount(0);
  await expect(user).toHaveCount(1);
  await expect(input).toHaveValue(`draft ${n}`);
  await page.reload();
  await expect(user).toHaveCount(1);
  await expect(agent).toHaveCount(0);
  await page.goto(other.url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: n })).toHaveCount(0);

  if (id === '@ux-original-024') {
    // Deleting a message with a reply follows the cascade confirmation: cancel keeps both, accept removes both.
    await page.goto(main.url);
    const m = nonce();
    const box = page.locator(sel('composeInput'));
    await box.fill(`[reply:child-${m}] parent-${m}`);
    await box.press('Enter');
    const parent = page.locator(sel('timelinePost')).filter({ hasText: `parent-${m}` });
    const child = page.locator(sel('agentPost')).filter({ hasText: `child-${m}` });
    await expect(child).toHaveCount(1);
    page.once('dialog', d => void d.dismiss());
    await parent.hover();
    await parent.getByRole('button', { name: /^delete message$/i }).click();
    await page.waitForTimeout(800);
    await expect(parent).toHaveCount(1);
    await expect(child).toHaveCount(1);
    page.once('dialog', d => void d.accept());
    await parent.hover();
    await parent.getByRole('button', { name: /^delete message$/i }).click();
    await expect(parent).toHaveCount(0);
    await expect(child).toHaveCount(0);
    await page.reload();
    await expect(page.locator(sel('composeInput'))).toBeVisible();
    await expect(page.locator(sel('timelinePost')).filter({ hasText: m })).toHaveCount(0);
  }
});

/** A speech engine that never finishes on its own; cancel() ends the current utterance asynchronously. */
const fakeSpeech = () => {
  const synth: any = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null, current: null,
    getVoices: () => [], pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
    speak(u: any) { this.current = u; this.speaking = true; setTimeout(() => u.onstart?.({}), 10); },
    cancel() { const u = this.current; this.current = null; this.speaking = false; if (u) setTimeout(() => u.onend?.({}), 10); },
  };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
};

for (const [id, name] of [
  ['@ux-shared-029', 'Copy and read assistant content truthfully'],
  ['@ux-original-028', 'Copy code and transfer post speech ownership'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = nonce();
  const clipboard = await recordClipboard(page);
  await page.addInitScript(fakeSpeech);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  const code = 'if (a < 2) return "x";';
  for (const k of ['one', 'two']) {
    await input.fill(`[reply:Reply ${k} ${n}\\n\\n\`\`\`js\\n${code}\\n\`\`\`] ask ${k} ${n}`);
    await input.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `Reply ${k} ${n}` })).toHaveCount(1);
  }
  const [a, b] = ['one', 'two'].map(k => page.locator(sel('agentPost')).filter({ hasText: `Reply ${k} ${n}` }));
  await a.getByRole('button', { name: /^copy code$/i }).click();
  expect((await clipboard()).map(t => t.trimEnd())).toEqual([code]);

  // Read aloud is offered on assistant posts; starting another post takes over, and the old post's late end does nothing.
  const user = page.locator(sel('userPost')).filter({ hasText: `ask one ${n}` });
  await user.hover();
  await expect(user.getByRole('button', { name: /read aloud/i })).toHaveCount(0);
  await a.hover();
  await a.getByRole('button', { name: /^read aloud$/i }).click();
  await expect(a.getByRole('button', { name: /stop reading/i })).toHaveCount(1);
  await b.hover();
  await b.getByRole('button', { name: /^read aloud$/i }).click();
  await expect(b.getByRole('button', { name: /stop reading/i })).toHaveCount(1);
  await expect(a.getByRole('button', { name: /^read aloud$/i })).toHaveCount(1);
  await page.waitForTimeout(300);
  await expect(b.getByRole('button', { name: /stop reading/i })).toHaveCount(1);
  await b.getByRole('button', { name: /stop reading/i }).click();
  await expect(b.getByRole('button', { name: /^read aloud$/i })).toHaveCount(1);
});

test('@ux-shared-029 Read aloud is absent without browser speech support', async ({ page, runtime, sel }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }));
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill('[reply:Hello there] hi');
  await input.press('Enter');
  const post = page.locator(sel('agentPost')).filter({ hasText: 'Hello there' });
  await expect(post).toHaveCount(1);
  await post.hover();
  await expect(post.getByRole('button', { name: /^copy message$/i })).toHaveCount(1);
  await expect(post.getByRole('button', { name: /read aloud/i })).toHaveCount(0);
});

test('@ux-shared-033 Copy message on an assistant post gives the Markdown as written', async ({ page, runtime, sel }) => {
  const n = nonce();
  const clipboard = await recordClipboard(page);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:**Bold ${n}** and \`a < b\`] ask ${n}`);
  await input.press('Enter');
  const agent = page.locator(sel('agentPost')).filter({ hasText: `Bold ${n}` });
  await expect(agent).toHaveCount(1);
  await agent.hover();
  await agent.getByRole('button', { name: /^copy message$/i }).click();
  expect(await clipboard()).toEqual([`**Bold ${n}** and \`a < b\``]);
});

for (const who of ['user', 'assistant'] as const) {
  test(`@ux-shared-033 Code with angle brackets is shown and copied exactly: ${who} post`, async ({ page, runtime, sel }) => {
    const n = nonce();
    const clipboard = await recordClipboard(page);
    await page.goto((await runtime.newSession()).url);
    const input = page.locator(sel('composeInput'));
    const code = 'if (a < b && c > d) return x <i> y;';
    if (who === 'user') await input.fill(`Code ${n}\n\n\`\`\`js\n${code}\n\`\`\``);
    else await input.fill(`[reply:Code ${n}\\n\\n\`\`\`js\\n${code}\\n\`\`\`] ask ${n}`);
    await input.press('Enter');
    const post = page.locator(sel(who === 'user' ? 'userPost' : 'agentPost'))
      .filter({ hasText: `Code ${n}` }).filter({ has: page.locator('pre code') }).last();
    await expect(post).toHaveCount(1);
    await expect.poll(async () => (await post.locator('pre code').first().innerText()).trimEnd()).toBe(code);
    await post.getByRole('button', { name: /^copy code$/i }).click();
    expect((await clipboard()).map(t => t.trimEnd())).toEqual([code]);
  });
}
