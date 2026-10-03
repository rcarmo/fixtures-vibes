/**
 * Portable picker semantics. Runtimes may expose pickers as a listbox of options or a menu of menu items, and label
 * fixture models by display name ("fixture model two") or by ID ("fixture-vibes/fixture-2 • 32K ctx").
 */
import type { Locator, Page } from '@playwright/test';

export const ENTRY = '[role="option"], [role="menuitem"], [role="menuitemradio"]';
const list = (page: Page, name: RegExp) => page.getByRole('listbox', { name }).or(page.getByRole('menu', { name }));
export const modelList = (page: Page) => list(page, /models/i);
export const sessionList = (page: Page) => list(page, /sessions/i);
/** Entries of a picker list, optionally filtered by text. */
export const entries = (container: Locator, text?: RegExp | string) =>
  text === undefined ? container.locator(ENTRY) : container.locator(ENTRY).filter({ hasText: text });
export const MODEL_ONE = /fixture-1(?!\d)|fixture model(?! two)/i;
export const MODEL_TWO = /fixture-2(?!\d)|fixture model two/i;
/** Matches a session or agent name as a whole token (so "ta1" does not match "zz-ta1"), with or without a leading "@". */
export const nameRe = (name: string) => new RegExp(`(?:^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
