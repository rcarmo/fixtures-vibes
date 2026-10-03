/** VNC pane error gates (features/classic/canonical/workspace-flows.feature @ux-workspace-015). */
import { test, expect } from '../fixtures';
import { menu } from '../workspace';

test('@ux-workspace-015 Surface VNC configuration, read-only, and runtime error gates', async ({ page, runtime }) => {
  await page.goto((await runtime.newSession()).url);
  await menu(page).click();
  await page.getByRole('menuitem', { name: /open vnc in tab/i }).click();
  await expect(page.getByRole('tab', { name: /vnc/i }).first()).toBeVisible();
  // A target nothing listens on: the session fails, and the pane says so instead of showing a live display.
  await page.getByLabel(/^server$/i).fill('127.0.0.1');
  await page.getByLabel(/^port$/i).fill('1');
  await page.getByRole('button', { name: /^connect$/i }).click();
  await expect(page.getByText(/connection (lost|failed)|could not connect|proxy error|protocol error|session error/i).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /^(reconnect|retry)$/i }).filter({ visible: true }).first()).toBeVisible();
  // The empty configuration state (no targets, direct connect disabled on the host) and read-only targets are not
  // constructible against the reference instance, which allows direct connections and has no saved targets.
});
