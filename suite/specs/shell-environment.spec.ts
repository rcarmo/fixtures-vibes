/**
 * Shell detection, variable expansion and environment settings
 * (features/classic/shell-environment/shell-environment.feature @ux-shell-env-001..010).
 * Commands print verdicts, so secrets never need to appear in the transcript. Keychain entries and environment
 * overrides use unique names and are removed afterwards. @cap-windows-shell scenarios use PowerShell syntax and run only
 * for runtime profiles that claim it (no Windows reference instance; derived from Piclaw 3.2.5 source).
 */
import { test, expect } from '../fixtures';
import { randomUUID } from 'node:crypto';
import type { Page, Locator } from '@playwright/test';
import { envName, openSettingsSection, listed, shell, withEntries, type Sel } from '../keychain';

const id = () => randomUUID().slice(0, 8);

test.beforeEach(async ({ page, runtime }) => { await page.goto((await runtime.newSession()).url); });

test('@ux-shell-env-001 Run commands in the detected POSIX shell', async ({ page, runtime, sel }) => {
  // $SHELL when it names an existing file, else bash (/bin/bash, then PATH). Compared by resolved executable.
  const out = await shell(page, runtime, sel, [
    'if [ -n "$SHELL" ] && [ -e "$SHELL" ]; then want=$(readlink -f "$SHELL"); elif [ -e /bin/bash ]; then want=$(readlink -f /bin/bash); else want=$(readlink -f "$(command -v bash)"); fi',
    'got=$(readlink -f /proc/$$/exe 2>/dev/null || command -v "$(ps -o comm= -p $$)")',
    '[ "$(basename "$got")" = "$(basename "$want")" ] && echo shell-ok || echo "shell-no got=$got want=$want"',
  ].join('; '));
  expect(out).toContain('shell-ok');
});

test('@ux-shell-env-002 Run commands in the detected Windows shell', async ({ page, runtime, sel }) => {
  const out = await shell(page, runtime, sel,
    '$pw = [bool](Get-Command pwsh.exe -ErrorAction SilentlyContinue); "edition=$($PSVersionTable.PSEdition) pwsh=$pw"');
  expect(out).toMatch(/edition=(Core|Desktop)/);
  // pwsh is preferred whenever it can be started.
  expect(out).not.toContain('edition=Desktop pwsh=True');
});

test('@ux-shell-env-003 Detect variable references in every syntax', async ({ page, runtime, sel }) => {
  const n = id();
  const entry = { name: `fixtures/kce-${n}`, secret: `ref-${n}` };
  const VAR = envName(entry.name)!;
  const sees = `test "$(printenv ${VAR})" = "${entry.secret}" && echo ref-set || echo ref-unset`;
  await withEntries(page, sel, [entry], async () => {
    expect(await shell(page, runtime, sel, `${sees} # $env:${VAR}`)).toContain('ref-set');
    expect(await shell(page, runtime, sel, `${sees} # %${VAR}%`)).toContain('ref-set');
    expect(await shell(page, runtime, sel, `: '$${VAR}'; ${sees}`)).toContain('ref-set');
    expect(await shell(page, runtime, sel, `${sees} # $${VAR.toLowerCase()}`)).toContain('ref-unset');
  });
});

test('@ux-shell-env-004 Retrieve only the referenced keychain entries', async ({ page, runtime, sel }) => {
  const n = id();
  const entries = ['a', 'b', 'c'].map(k => ({ name: `fixtures/kcq${k}-${n}`, secret: `${n}-sec-${k}` }));
  const A = envName(entries[0].name)!;
  await withEntries(page, sel, entries, async () => {
    const one = await shell(page, runtime, sel, `test "$${A}" = "${entries[0].secret}" && echo a-set; echo "count=$(env | grep -c "${n}-sec-")"`);
    expect(one).toContain('a-set');
    expect(one).toContain('count=1');
    expect(await shell(page, runtime, sel, `echo "count=$(env | grep -c "${n}-sec-")"`)).toContain('count=0');
  });
});

test('@ux-shell-env-005 Name keychain variables exactly like Piclaw', async ({ page, runtime, sel }) => {
  const n = id();
  const lower = { name: `fixtures_lower_${n}`, secret: `lower-${n}` };
  const slash = { name: `fixtures/kcc-${n}`, secret: `slash-${n}` };
  const dot = { name: `fixtures.kcc.${n}`, secret: `dot-${n}` };
  expect(envName(lower.name)).toBe(lower.name);
  expect(envName(slash.name)).toBe(envName(dot.name));
  const COLL = envName(dot.name)!;
  await withEntries(page, sel, [lower, slash, dot], async () => {
    const out = await shell(page, runtime, sel, [
      `test "$${lower.name}" = "${lower.secret}" && echo lower-ok || echo lower-no`,
      `test "$${COLL}" = "${dot.secret}" && echo coll-ok || echo "coll-no"`,
    ].join('; '));
    expect(out).toContain('lower-ok');
    expect(out).toContain('coll-ok');
  });
});

test('@ux-shell-env-006 Fail a command whose keychain placeholder cannot be resolved', async ({ page, runtime, sel }) => {
  const n = id();
  const bare = { name: `fixtures/kcn-${n}`, secret: `bare-${n}` };
  // "ran-42" only appears if the shell actually ran the command.
  const missing = await shell(page, runtime, sel, `echo "ran-$((40+2))" keychain:fixtures/missing-${n}`);
  expect(missing).not.toContain('ran-42');
  expect(missing).toMatch(/not found|keychain/i);
  await withEntries(page, sel, [bare], async () => {
    const noUser = await shell(page, runtime, sel, `echo "ran-$((40+2))" keychain:${bare.name}:username`);
    expect(noUser).not.toContain('ran-42');
    expect(noUser).toMatch(/username/i);
  });
});

test('@ux-shell-env-007 Expand keychain variables in PowerShell', async ({ page, runtime, sel }) => {
  const n = id();
  const entry = { name: `fixtures/kcw-${n}`, secret: `ps-${n}` };
  const VAR = envName(entry.name)!;
  await withEntries(page, sel, [entry], async () => {
    const out = await shell(page, runtime, sel,
      `if ($env:${VAR} -eq '${entry.secret}') { 'env-ok' } else { 'env-no' }; if ('keychain:${entry.name}' -eq '${entry.secret}') { 'ph-ok' } else { 'ph-no' }`);
    expect(out).toContain('env-ok');
    expect(out).toContain('ph-ok');
  });
});

// Environment section: a name field, a value field and a save control add an override; each listed variable can be
// edited and cleared. Located by role and loose names, since the section may be simpler than Piclaw's.
async function openEnvironment(page: Page, sel: Sel) {
  const d = await openSettingsSection(page, sel, /^\s*environment\s*$/i);
  // Loaded once the inherited variables are listed (PATH is always inherited).
  await expect(listed(d, 'PATH').first()).toBeAttached();
  return d;
}
const rowOf = (d: Locator, name: string) => listed(d, name).first().locator('xpath=ancestor::*[.//input][1]');
async function addOverride(d: Locator, name: string, value: string) {
  await d.getByLabel(/^(variable )?name$/i).or(d.getByPlaceholder(/name/i)).first().fill(name);
  await d.getByLabel(/^value$/i).or(d.getByPlaceholder(/^value/i)).first().fill(value);
  await d.getByRole('button', { name: /^(save|add|set)$/i }).first().click();
}
async function editOverride(d: Locator, name: string, value: string) {
  const row = rowOf(d, name);
  await row.locator('input').first().fill(value);
  await row.getByRole('button', { name: /^(save|set|update)$/i }).click();
  await expect(row.locator('input').first()).toHaveValue(value);
}
async function clearOverride(d: Locator, name: string) {
  if (!(await listed(d, name).count())) return;
  await rowOf(d, name).getByRole('button', { name: /clear|reset|remove|delete/i }).first().click();
  await expect(listed(d, name)).toHaveCount(0);
}
async function close(page: Page, d: Locator) {
  await page.keyboard.press('Escape');
  await expect(d).toHaveCount(0);
}
const sees = (name: string, value: string) => `test "$(printenv ${name})" = "${value}" && echo env-is-${value} || echo env-not-${value}`;

test('@ux-shell-env-008 Override an environment variable from Settings', async ({ page, runtime, sel }) => {
  const n = id();
  const name = `FIXTURES_ENV_${n.toUpperCase()}`;
  let d = await openEnvironment(page, sel);
  try {
    await expect(listed(d, 'PATH').first()).toBeAttached();
    await addOverride(d, name, `one-${n}`);
    await expect(listed(d, name).first()).toBeVisible();
    await close(page, d);
    expect(await shell(page, runtime, sel, sees(name, `one-${n}`))).toContain(`env-is-one-${n}`);
    d = await openEnvironment(page, sel);
    await editOverride(d, name, `two-${n}`);
    await close(page, d);
    expect(await shell(page, runtime, sel, sees(name, `two-${n}`))).toContain(`env-is-two-${n}`);
    d = await openEnvironment(page, sel);
    await clearOverride(d, name);
    await close(page, d);
    expect(await shell(page, runtime, sel, `printenv ${name} >/dev/null && echo still-set || echo now-unset`)).toContain('now-unset');
  } finally {
    d = await openEnvironment(page, sel);
    await clearOverride(d, name);
  }
});

test('@ux-shell-env-009 Keep environment overrides across reloads', async ({ page, sel }) => {
  const n = id();
  const name = `FIXTURES_ENVP_${n.toUpperCase()}`;
  let d = await openEnvironment(page, sel);
  try {
    await addOverride(d, name, `kept-${n}`);
    await expect(listed(d, name).first()).toBeVisible();
    await page.reload();
    d = await openEnvironment(page, sel);
    await expect(listed(d, name).first()).toBeVisible();
    await expect(rowOf(d, name).locator('input').first()).toHaveValue(`kept-${n}`);
  } finally {
    d = await openEnvironment(page, sel);
    await clearOverride(d, name);
  }
});

test('@ux-shell-env-010 Keep keychain variables out of the Environment section', async ({ page, runtime, sel }) => {
  const n = id();
  const entry = { name: `fixtures/kcv-${n}`, secret: `vault-${n}` };
  const VAR = envName(entry.name)!;
  await withEntries(page, sel, [entry], async () => {
    const d = await openEnvironment(page, sel);
    await expect(listed(d, 'PATH').first()).toBeAttached();
    await expect(listed(d, VAR)).toHaveCount(0);
    await addOverride(d, VAR, `override-${n}`);
    await page.waitForTimeout(500);
    await expect(listed(d, VAR)).toHaveCount(0);
    await close(page, d);
    expect(await shell(page, runtime, sel, `test "$${VAR}" = "${entry.secret}" && echo kept-secret || echo lost-secret`)).toContain('kept-secret');
  });
});
