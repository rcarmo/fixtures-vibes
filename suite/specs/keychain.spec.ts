/**
 * Keychain management and shell substitution (features/classic/keychain/keychain.feature @ux-keychain-001..007).
 * The Settings section may look different from Piclaw's, so the specs find controls by role and loose accessible names
 * (add/save, reveal/show, delete/remove, yes/confirm, no/cancel; a password prompt when reveal is protected) and assert
 * behaviour only. Entries use unique names and are deleted afterwards. Shell commands print a verdict, so secrets never
 * need to appear in the transcript.
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
  // The section control (button, tab or link) shows the word "Keychain".
  await dialog.getByRole('button').or(dialog.getByRole('tab')).or(dialog.getByRole('link')).filter({ hasText: /^\s*keychain\s*$/i }).first().click();
  await expect(addButton(dialog)).toBeVisible();
  return dialog;
}
const addButton = (d: Locator) => d.getByRole('button', { name: /^\W*(add|new)\b(?!-)/i }).first();
const listed = (d: Locator, name: string) => d.getByText(name, { exact: true });
/** The smallest element holding the entry's name and its controls. */
const entryOf = (d: Locator, name: string) => listed(d, name).first().locator('xpath=ancestor::*[.//button][1]');

async function addEntry(d: Locator, e: { name: string; secret: string; username?: string }) {
  await addButton(d).click();
  await d.getByLabel(/^(entry )?name$/i).fill(e.name);
  if (e.username) {
    // Some keychains only take a username for one entry type ("basic" in Piclaw).
    const type = d.getByLabel(/^(entry )?type$/i);
    if (await type.count()) await type.selectOption('basic').catch(() => {});
    await d.getByLabel(/^(entry )?user ?name$/i).fill(e.username);
  }
  await d.getByLabel(/^(entry )?(secret|value|password)$/i).fill(e.secret);
  await d.getByRole('button', { name: /^(save|add|create)$/i }).click();
  await expect(listed(d, e.name).first()).toBeVisible();
}

/** Ask to delete; the confirmation is either a native dialog or a visible confirm/decline control. */
async function deleteEntry(page: Page, d: Locator, name: string, answer: 'accept' | 'dismiss', opts: { force?: boolean } = {}) {
  let native = false;
  const onDialog = (dlg: any) => { native = true; void dlg[answer](); };
  page.once('dialog', onDialog);
  const del = entryOf(d, name).getByRole('button', { name: /delete|remove/i }).first();
  if (opts.force) await del.click({ timeout: 3_000 }).catch(() => del.dispatchEvent('click'));
  else await del.click();
  await page.waitForTimeout(200);
  page.off('dialog', onDialog);
  if (native) return;
  // A confirmation offers a way to decline. If it sits on the entry, the accept control is there too; otherwise it is a
  // separate prompt whose controls use plain yes/no wording, so other rows' delete buttons are never hit.
  const no = /^(no|cancel)$/i;
  const declineInRow = entryOf(d, name).getByRole('button', { name: no });
  await expect(declineInRow.or(page.getByRole('button', { name: no }).filter({ visible: true })).first()).toBeVisible({ timeout: 5_000 });
  const inRow = await declineInRow.isVisible();
  const scope = inRow ? entryOf(d, name) : page;
  const target = answer === 'dismiss'
    ? scope.getByRole('button', { name: no }).filter({ visible: true }).last()
    : scope.getByRole('button', { name: inRow ? /^(yes|confirm|ok)$|delete|remove/i : /^(yes|confirm|ok|delete|remove)$/i }).filter({ visible: true }).last();
  if (opts.force) await target.click({ timeout: 3_000 }).catch(() => target.dispatchEvent('click'));
  else await target.click();
}
/** Cleanup (setup, not the spec): where taps cannot reach the control (listed defect) events are dispatched. */
async function cleanup(page: Page, d: Locator, name: string) {
  await expect(async () => {
    if (await listed(d, name).count()) await deleteEntry(page, d, name, 'accept', { force: true });
    await expect(listed(d, name)).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
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

  test('@ux-keychain-001 Add a credential from Settings', async ({ page, sel }) => {
    const n = randomUUID().slice(0, 8);
    const name = `fixtures/kc-${n}.v1`, secret = `secret-${n}`;
    const d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name, secret, username: `user-${n}` });
      await expect(listed(d, name).first()).toBeVisible();
      await expect(d.getByText(secret)).toHaveCount(0);
    } finally {
      await cleanup(page, d, name);
    }
  });

  test('@ux-keychain-002 Keep keychain entries across sessions', async ({ page, sel }) => {
    const n = randomUUID().slice(0, 8);
    const name = `fixtures/kcp-${n}`, secret = `kept-${n}`;
    let d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name, secret });
      await page.reload();
      d = await openKeychain(page, sel);
      await expect(listed(d, name).first()).toBeVisible();
      await expect(d.getByText(secret)).toHaveCount(0);
    } finally {
      await cleanup(page, d, name);
    }
  });

  test('@ux-keychain-003 Reveal a secret only on request', async ({ page, runtime, sel }) => {
    const password: string | undefined = runtime.profile.keychain?.masterPassword;
    const n = randomUUID().slice(0, 8);
    const [a, b] = [`fixtures/kcr-${n}`, `fixtures/kco-${n}`];
    const d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name: a, secret: `shown-${n}` });
      await addEntry(d, { name: b, secret: `other-${n}` });
      await expect(d.getByText(`shown-${n}`)).toHaveCount(0);
      await entryOf(d, a).getByRole('button', { name: /reveal|show/i }).first().click();
      const prompt = page.locator('input[type=password]').filter({ visible: true }).last();
      if (await prompt.waitFor({ timeout: 1_500 }).then(() => true, () => false)) {
        test.skip(!password, 'reveal asks for a master password but the runtime profile supplies none');
        await expect(d.getByText(`shown-${n}`)).toHaveCount(0);
        await prompt.fill(password!);
        await prompt.press('Enter');
      }
      await expect(d.getByText(`shown-${n}`)).toBeVisible();
      await expect(d.getByText(`other-${n}`)).toHaveCount(0);
    } finally {
      for (const name of [a, b]) await cleanup(page, d, name);
    }
  });

  test('@ux-keychain-004 Delete an entry after confirming', async ({ page, sel }) => {
    const n = randomUUID().slice(0, 8);
    const name = `fixtures/kcd-${n}`;
    const d = await openKeychain(page, sel);
    try {
      await addEntry(d, { name, secret: `s-${n}` });
      await deleteEntry(page, d, name, 'dismiss');
      await expect(listed(d, name).first()).toBeVisible();
      await deleteEntry(page, d, name, 'accept');
      await expect(listed(d, name)).toHaveCount(0);
    } finally {
      await cleanup(page, d, name);
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
    for (const e of [entry, other]) if (!(await listed(d, e.name).count())) await addEntry(d, e);
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
  });
  test.afterEach(async ({ page, sel }) => {
    const d = await openKeychain(page, sel);
    for (const e of [entry, other]) await cleanup(page, d, e.name);
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
    // Indirect lookup (POSIX: eval of a built reference) and enumeration request nothing.
    expect(await shell(page, runtime, sel, `v=${OTHER}; eval "x=\\\${$v}"; test -z "$x" && echo dyn-empty || echo dyn-set`)).toContain('dyn-empty');
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
