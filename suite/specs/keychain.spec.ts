/**
 * Keychain management and shell substitution (features/classic/keychain/keychain.feature @ux-keychain-001..007).
 * Entries are created through Settings under unique names and deleted afterwards. Shell commands run through the
 * runtime's shell tool; each prints a verdict, so secrets never need to appear in the transcript.
 */
import { test, expect } from '../fixtures';
import { randomUUID } from 'node:crypto';
import type { Page, Locator } from '@playwright/test';

type Sel = (k: string) => string;
const esc = (s: string) => s.replace(/[[\]]/g, m => '\\' + m);
/** The documented name → shell variable rule. */
const envName = (name: string) => {
  const v = name.replace(/[/.-]+/g, '_').replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
  return v && !/^\d/.test(v) ? v : null;
};

async function openKeychain(page: Page, sel: Sel) {
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  const dialog = page.locator(sel('settingsDialog'));
  for (let i = 0; i < 3 && !(await dialog.count()); i++) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+Comma');
    await dialog.waitFor({ timeout: 2_000 }).catch(() => {});
  }
  await dialog.locator('nav').getByRole('button').filter({ hasText: /^\s*Keychain\s*$/i }).click();
  await expect(dialog.getByRole('button', { name: /add entry/i })).toBeVisible();
  return dialog;
}
const count = (d: Locator) => d.getByText(/\d+ entr(y|ies)\b.*encrypted/i).first();
const entries = async (d: Locator) => Number(/(\d+) entr/i.exec(await count(d).innerText())?.[1] ?? NaN);
async function addEntry(d: Locator, e: { name: string; type?: string; secret: string; username?: string; note?: string }) {
  await d.getByRole('button', { name: /add entry/i }).click();
  await d.getByLabel(/^entry name$/i).fill(e.name);
  if (e.type) await d.getByLabel(/^entry type$/i).selectOption(e.type);
  await d.getByLabel(/^entry secret$/i).fill(e.secret);
  if (e.username) await d.getByLabel(/^entry username$/i).fill(e.username);
  // The add form's own note (each listed row has one too).
  if (e.note) await d.getByLabel(/^entry name$/i).locator('xpath=ancestor::*[.//textarea][1]').getByLabel(/^user note$/i).first().fill(e.note);
  await d.getByRole('button', { name: /^save$/i }).click();
  await expect(d.getByText(e.name, { exact: true }).first()).toBeVisible();
}
const row = (d: Locator, name: string) => d.getByText(name, { exact: true }).first().locator('xpath=ancestor::tr[1]');
/** Cleanup: delete an entry (row action, then its confirmation, which carries the same name). Where the row action
 *  cannot be tapped (narrow layouts, listed defect) the events are dispatched directly; this is setup, not the spec. */
async function deleteEntry(d: Locator, name: string) {
  for (let i = 0; i < 2; i++) {
    const del = d.getByRole('button', { name: `Delete ${name}` }).first();
    if (!(await del.count())) break;
    await del.click({ timeout: 3_000 }).catch(() => del.dispatchEvent('click'));
  }
  await expect(d.getByText(name, { exact: true })).toHaveCount(0);
}
/** Run a shell command through the agent; returns what the command printed. */
async function shell(page: Page, runtime: any, sel: Sel, command: string) {
  const tag = `sh-${randomUUID().slice(0, 8)}`;
  const tool = runtime.toolName('shell');
  const input = page.locator(sel('composeInput'));
  await input.fill(`[tool:${tool} ${esc(JSON.stringify({ command }))}][after-tool:${tag}] run ${tag}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
  const log = await runtime.modelLog();
  return String(log.filter((e: any) => e.toolFollowUp).at(-1)?.toolResult ?? '');
}

test.describe('settings', () => {
  test.beforeEach(async ({ page, runtime }) => { await page.goto((await runtime.newSession()).url); });

  test('@ux-keychain-001 Add a credential from the Keychain settings section', async ({ page, sel }) => {
    const n = randomUUID().slice(0, 8);
    const name = `fixtures/kc-${n}.v1`, secret = `secret-${n}`;
    const d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name, type: 'basic', secret, username: `user-${n}`, note: `note ${n}` });
      const r = row(d, name);
      await expect(r).toContainText(/basic/i);
      await expect(r).toContainText(envName(name)!);
      await expect(r).toContainText(/\d{4}|\bago\b|today/i);
      // The count reports the encrypted entries (filtered to this one, since other tests share the keychain).
      await expect(count(d)).toContainText(/encrypted at rest/i);
      await d.getByPlaceholder(/filter entries/i).fill(name);
      await expect.poll(() => entries(d)).toBe(1);
      await d.getByPlaceholder(/filter entries/i).fill('');
      await expect(d.getByText(secret)).toHaveCount(0);
    } finally {
      await deleteEntry(d, name);
    }
  });

  test('@ux-keychain-002 Filter keychain entries', async ({ page, sel }) => {
    const n = randomUUID().slice(0, 8);
    const names = [`fixtures/kca-${n}`, `fixtures/kcb-${n}`];
    const d = await openKeychain(page, sel);
    try {
      for (const name of names) await addEntry(d, { name, secret: `s-${n}` });
      const filter = d.getByPlaceholder(/filter entries/i);
      // (Re-applied if a concurrent catalogue refresh lands while typing.)
      await expect(async () => {
        await filter.fill(`kca-${n}`);
        await expect(d.getByText(names[0], { exact: true })).toBeVisible({ timeout: 2_000 });
        await expect(d.getByText(names[1], { exact: true })).toHaveCount(0, { timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
      await expect(count(d)).toContainText(/1 entr(y|ies)/i);
      await expect(count(d)).toContainText(`kca-${n}`);
      await filter.fill(`nothing-${n}`);
      await expect(d.getByText(/no entries match/i)).toBeVisible();
      await filter.fill('');
    } finally {
      for (const name of names) await deleteEntry(d, name);
    }
  });

  test('@ux-keychain-003 Reveal a secret only after unlocking', async ({ page, runtime, sel }) => {
    const password = runtime.profile.keychain?.masterPassword;
    test.skip(!password, 'the runtime profile supplies no keychain master password');
    const n = randomUUID().slice(0, 8);
    const [a, b] = [`fixtures/kcr-${n}`, `fixtures/kco-${n}`];
    const d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name: a, secret: `shown-${n}` });
      await addEntry(d, { name: b, secret: `other-${n}` });
      await d.getByRole('button', { name: `Reveal secret: ${a}` }).click();
      const prompt = d.locator('input[type=password]').filter({ visible: true }).last();
      await expect(prompt).toBeVisible();
      await expect(d.getByText(`shown-${n}`)).toHaveCount(0);
      await prompt.fill(password!);
      await d.getByRole('button', { name: /^unlock$/i }).click();
      await expect(d.getByText(`shown-${n}`)).toBeVisible();
      await expect(d.getByText(`other-${n}`)).toHaveCount(0);
      await expect(d.getByRole('button', { name: /^copy secret$/i })).toBeVisible();
      await d.getByRole('button', { name: `Hide secret: ${a}` }).click();
      await expect(d.getByText(`shown-${n}`)).toHaveCount(0);
    } finally {
      for (const name of [a, b]) await deleteEntry(d, name);
    }
  });

  test('@ux-keychain-004 Delete an entry after an inline confirmation', async ({ page, sel }) => {
    const n = randomUUID().slice(0, 8);
    const name = `fixtures/kcd-${n}`;
    const d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name, secret: `s-${n}` });
      await d.getByPlaceholder(/filter entries/i).fill(name);
      await expect.poll(() => entries(d)).toBe(1);
      await d.getByRole('button', { name: `Delete ${name}` }).click();
      const no = row(d, name).getByRole('button', { name: /^(no|cancel)$/i });
      await expect(no).toBeVisible();
      await no.click();
      await expect(d.getByText(name, { exact: true })).toBeVisible();
      await d.getByRole('button', { name: `Delete ${name}` }).click();
      await row(d, name).getByRole('button', { name: new RegExp(`^(yes|confirm|delete ${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')})$`, 'i') }).first().click();
      await expect(d.getByText(name, { exact: true })).toHaveCount(0);
      await expect.poll(() => entries(d)).toBe(0);
      await d.getByPlaceholder(/filter entries/i).fill('');
    } finally {
      await deleteEntry(d, name);
    }
  });
});

test.describe('shell', () => {
  const n = randomUUID().slice(0, 8);
  const entry = { name: `fixtures/kcs-${n}.v1`, secret: `s3cret-${n}`, username: `user-${n}` };
  const other = { name: `fixtures/kcx-${n}`, secret: `unnamed-${n}` };
  const VAR = envName(entry.name)!, OTHER = envName(other.name)!;

  test.beforeEach(async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    const d = await openKeychain(page, sel);
    for (const e of [entry, other]) if (!(await d.getByText(e.name, { exact: true }).count())) await addEntry(d, { ...e, type: 'basic' });
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
  });
  test.afterEach(async ({ page, sel }) => {
    const d = await openKeychain(page, sel);
    for (const e of [entry, other]) await deleteEntry(d, e.name);
  });

  test('@ux-keychain-005 Inject a credential into a shell command that names its variable', async ({ page, runtime, sel }) => {
    expect(VAR).toBe(`FIXTURES_KCS_${n.toUpperCase()}_V1`);
    expect(await shell(page, runtime, sel, `test "$${VAR}" = "${entry.secret}" && echo plain-ok || echo plain-no`)).toContain('plain-ok');
    expect(await shell(page, runtime, sel, `test "\${${VAR}}" = "${entry.secret}" && echo braced-ok || echo braced-no`)).toContain('braced-ok');
  });

  test('@ux-keychain-006 Inject only what the command text names', async ({ page, runtime, sel }) => {
    // Names one entry; the other is absent from the environment.
    const out = await shell(page, runtime, sel, `test -n "$${VAR}" && echo named-set; env | grep -c "${other.secret}" || true`);
    expect(out).toContain('named-set');
    expect(out).toMatch(/^0$/m);
    // Indirect expansion and enumeration request nothing.
    expect(await shell(page, runtime, sel, `v=${OTHER}; test -z "\${!v}" && echo dyn-empty || echo dyn-set`)).toContain('dyn-empty');
    expect(await shell(page, runtime, sel, `printenv | grep -c "${entry.secret}" || true`)).toMatch(/^0$/m);
  });

  test('@ux-keychain-007 Substitute keychain placeholders in command text', async ({ page, runtime, sel }) => {
    const check = (expr: string, value: string, label: string) => `test "${expr}" = "${value}" && echo ${label}-ok || echo ${label}-no`;
    const out = await shell(page, runtime, sel, [
      check(`keychain:${entry.name}`, entry.secret, 'secret'),
      check(`keychain:${entry.name}:username`, entry.username, 'username'),
      check(`keychain:${entry.name}:user`, entry.username, 'user'),
      check(`keychain:${entry.name}:password`, entry.secret, 'password'),
      check(`keychain:${entry.name}:token`, entry.secret, 'token'),
    ].join('; '));
    for (const label of ['secret', 'username', 'user', 'password', 'token']) expect(out).toContain(`${label}-ok`);
  });
});
