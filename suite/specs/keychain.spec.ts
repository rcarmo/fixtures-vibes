/**
 * Keychain management and shell substitution (features/classic/keychain/keychain.feature @ux-keychain-001..007).
 * The Settings section may look different from Piclaw's, so the specs find controls by role and loose accessible names
 * (add/save, reveal/show, delete/remove, yes/confirm, no/cancel; a password prompt when reveal is protected) and assert
 * behaviour only. Entries use unique names and are deleted afterwards. Shell commands print a verdict, so secrets never
 * need to appear in the transcript.
 */
import { test, expect } from '../fixtures';
import { randomUUID } from 'node:crypto';
import { envName, openKeychain, listed, entryOf, addEntry, deleteEntry, cleanup, shell } from '../keychain';

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
