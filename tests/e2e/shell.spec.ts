import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  // A throwaway profile keeps the suite from reading or writing real settings.
  userDataDir = mkdtempSync(join(tmpdir(), 'versescape-e2e-'));
  app = await electron.launch({
    args: ['out/main/index.js', `--user-data-dir=${userDataDir}`],
  });
  page = await app.firstWindow();
  await page.waitForSelector('[data-testid="rail"]');
});

test.afterAll(async () => {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

test('renders the shell with no OS titlebar', async () => {
  await expect(page.locator('.titlebar')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();

  const isFrameless = await app.evaluate(({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    return window ? !window.isMenuBarVisible() : false;
  });
  expect(isFrameless).toBe(true);
});

test('window controls drive the real window', async () => {
  await page.getByRole('button', { name: 'Maximize' }).click();
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Restore' }).click();
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false),
    )
    .toBe(false);
});

test('the rail collapses and expands', async () => {
  const rail = page.locator('[data-testid="rail"]');
  await expect(rail).toHaveClass(/rail--expanded/);

  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(rail).not.toHaveClass(/rail--expanded/);

  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(rail).toHaveClass(/rail--expanded/);
});

test('navigating opens the contextual sidebar and switches page', async () => {
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByRole('main')).toHaveAttribute('data-page', 'notes');
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

  // Re-selecting the active section collapses its sidebar.
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.locator('[data-testid="sidebar"]')).toHaveCount(0);
});

test('theme changes apply and survive a restart', async () => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await app.close();
  app = await electron.launch({
    args: ['out/main/index.js', `--user-data-dir=${userDataDir}`],
  });
  page = await app.firstWindow();
  await page.waitForSelector('[data-testid="rail"]');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('main')).toHaveAttribute('data-page', 'settings');
});

test('the About dialog credits the sources we are obliged to credit', async () => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'About VerseScape' }).click();

  const dialog = page.getByRole('dialog', { name: 'VerseScape' });
  await expect(dialog).toBeVisible();

  // CC BY 4.0 makes these two attributions a licence obligation, not a courtesy.
  await expect(dialog.getByRole('link', { name: 'STEP Bible' })).toHaveAttribute(
    'href',
    'https://www.STEPBible.org',
  );
  await expect(dialog.getByRole('link', { name: 'OpenBible.info' })).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Christian Classics Ethereal Library' }),
  ).toHaveAttribute('href', 'https://www.ccel.org');

  // External links must open in the browser, never in the app window.
  for (const link of await dialog.getByRole('link').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
