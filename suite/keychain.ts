/** Keychain Settings and shell helpers shared by keychain.spec.ts and shell-environment.spec.ts. */
import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Page, Locator } from '@playwright/test';

export type Sel = (k: string) => string;
export const esc = (s: string) => s.replace(/[[\]]/g, m => '\\' + m);
/** Piclaw's entry name → shell variable rule: identifiers unchanged, others mapped and upper-cased. */
export const envName = (name: string) => {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
  const v = name.replace(/[/.-]+/g, '_').replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
  return v && !/^\d/.test(v) ? v : null;
};

/** Open Settings at the section whose control (button, tab or link) shows `label`. */
export async function openSettingsSection(page: Page, sel: Sel, label: RegExp) {
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  const dialog = page.locator(sel('settingsDialog'));
  for (let i = 0; i < 3 && !(await dialog.count()); i++) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+Comma');
    await dialog.waitFor({ timeout: 2_000 }).catch(() => {});
  }
  await dialog.getByRole('button').or(dialog.getByRole('tab')).or(dialog.getByRole('link')).filter({ hasText: label }).first().click();
  return dialog;
}

export async function openKeychain(page: Page, sel: Sel) {
  const dialog = await openSettingsSection(page, sel, /^\s*keychain\s*$/i);
  await expect(addButton(dialog)).toBeVisible();
  return dialog;
}
export const addButton = (d: Locator) => d.getByRole('button', { name: /^\W*(add|new)\b(?!-)/i }).first();
export const listed = (d: Locator, name: string) => d.getByText(name, { exact: true });
/** The smallest element holding the entry's name and its controls. */
export const entryOf = (d: Locator, name: string) => listed(d, name).first().locator('xpath=ancestor::*[.//button][1]');

export async function addEntry(d: Locator, e: { name: string; secret: string; username?: string }) {
  await addButton(d).click();
  const name = d.getByLabel(/^(entry )?name$/i), secret = d.getByLabel(/^(entry )?(secret|value|password)$/i);
  // A form that is still settling after the previous save can lose or merge a fill: check each field before saving
  // and fill again once if needed.
  const fill = async (field: Locator, value: string) => {
    await field.fill(value);
    if (!(await expect(field).toHaveValue(value, { timeout: 2_000 }).then(() => true, () => false))) await field.fill(value);
  };
  await fill(name, e.name);
  if (e.username) {
    // Some keychains only take a username for one entry type ("basic" in Piclaw).
    const type = d.getByLabel(/^(entry )?type$/i);
    if (await type.count()) await type.selectOption('basic').catch(() => {});
    await fill(d.getByLabel(/^(entry )?user ?name$/i), e.username);
  }
  await fill(secret, e.secret);
  if ((await name.inputValue()) !== e.name) await fill(name, e.name);
  await expect(name).toHaveValue(e.name);
  await d.getByRole('button', { name: /^(save|add|create)$/i }).click();
  await expect(listed(d, e.name).first()).toBeVisible();
}

/** Ask to delete; the confirmation is either a native dialog or a visible confirm/decline control. */
export async function deleteEntry(page: Page, d: Locator, name: string, answer: 'accept' | 'dismiss', opts: { force?: boolean } = {}) {
  let native = false;
  const onDialog = (dlg: any) => { native = true; void dlg[answer](); };
  page.once('dialog', onDialog);
  const del = entryOf(d, name).getByRole('button', { name: /delete|remove/i }).first();
  if (opts.force) await del.click({ timeout: 3_000 }).catch(() => del.dispatchEvent('click'));
  else await del.click({ timeout: 10_000 }); // bounded, so cleanup still runs on failure
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
  else await target.click({ timeout: 10_000 });
}
/** Cleanup (setup, not the spec): where taps cannot reach the control (listed defect) events are dispatched. */
export async function cleanup(page: Page, d: Locator, name: string) {
  await expect(async () => {
    if (await listed(d, name).count()) await deleteEntry(page, d, name, 'accept', { force: true });
    await expect(listed(d, name)).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

/** Run a shell command through the agent; returns what the command printed. */
export async function shell(page: Page, runtime: any, sel: Sel, command: string) {
  const tag = `sh-${randomUUID().slice(0, 8)}`;
  const tool = runtime.toolName('shell');
  const input = page.locator(sel('composeInput'));
  await input.fill(`[tool:${tool} ${esc(JSON.stringify({ command }))}][after-tool:${tag}] run ${tag}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
  const log = await runtime.modelLog();
  return String(log.filter((e: any) => e.toolFollowUp && JSON.stringify(e.directives).includes(tag)).at(-1)?.toolResult ?? '');
}

/** Create entries through Settings, run `fn` with the dialog closed, then delete them again. */
export async function withEntries(page: Page, sel: Sel, entries: Array<{ name: string; secret: string; username?: string }>, fn: () => Promise<void>) {
  let d = await openKeychain(page, sel);
  try {
    for (const e of entries) await addEntry(d, e);
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
    await fn();
  } finally {
    d = await openKeychain(page, sel);
    for (const e of entries) await cleanup(page, d, e.name);
    await page.keyboard.press('Escape');
  }
}
