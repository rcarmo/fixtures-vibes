import type { Page } from '@playwright/test';

/** Record what the page puts on the clipboard: `copy` event data (execCommand path) and `navigator.clipboard.writeText`. */
export async function recordClipboard(page: Page) {
  await page.addInitScript(() => {
    (window as any).__clip = [];
    window.addEventListener('copy', (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') || String(document.getSelection() ?? '');
      (window as any).__clip.push(text);
    });
    const c = navigator.clipboard as any;
    if (c?.writeText) { const write = c.writeText.bind(c); c.writeText = async (t: string) => { (window as any).__clip.push(t); return write(t).catch(() => {}); }; }
  });
  return async () => (await page.evaluate(() => (window as any).__clip.splice(0))) as string[];
}
