/**
 * Portable picker semantics. Runtimes may expose pickers as a listbox of options or a menu of menu items, and label
 * fixture models by display name ("fixture model two") or by ID ("fixture-vibes/fixture-2 • 32K ctx").
 */
import { expect, type Locator, type Page } from '@playwright/test';

export const ENTRY = '[role="option"], [role="menuitem"], [role="menuitemradio"]';
const list = (page: Page, name: RegExp) => page.getByRole('listbox', { name }).or(page.getByRole('menu', { name }));
export const modelList = (page: Page) => list(page, /models/i);
export const sessionList = (page: Page) => list(page, /sessions/i);
/** Entries of a picker list, optionally filtered by accessible name (text content may join sibling spans). */
export const entries = (container: Locator, name?: RegExp | string) =>
  name === undefined ? container.locator(ENTRY)
    : container.getByRole('option', { name }).or(container.getByRole('menuitem', { name })).or(container.getByRole('menuitemradio', { name }));
/** The keyboard highlight (canonical selector `pickerHighlight`): never merely the "current" entry. */
export const highlighted = (container: Locator, sel: (k: string) => string) => container.locator(sel('pickerHighlight'));
export const MODEL_ONE = /fixture-1(?!\d)|fixture model(?! two)/i;
export const MODEL_TWO = /fixture-2(?!\d)|fixture model two/i;
/** Matches a session or agent name as a whole token (so "ta1" does not match "zz-ta1"), with or without a leading "@". */
export const nameRe = (name: string) => new RegExp(`(?:^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);

/** A search field by name: runtimes expose it as a searchbox, a textbox or an ARIA combobox (autocomplete list). */
export const searchField = (scope: Pick<Page, 'getByRole'> | Pick<Locator, 'getByRole'>, name: RegExp) =>
  scope.getByRole('searchbox', { name }).or(scope.getByRole('combobox', { name })).or(scope.getByRole('textbox', { name })).first();

/** Wait until the open model picker holds keyboard focus (its list or the search field controlling it), then type. */
export async function typeInModelPicker(page: Page, text: string) {
  const picker = modelList(page);
  await expect(picker).toBeVisible();
  await expect.poll(() => picker.first().evaluate(el => {
    const a = document.activeElement;
    return !!a && a !== document.body && (el.contains(a) || (!!el.id && a.getAttribute('aria-controls') === el.id));
  }), { message: 'model picker has focus' }).toBe(true);
  await page.keyboard.type(text);
}
