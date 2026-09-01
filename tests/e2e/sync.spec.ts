import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

async function launch(): Promise<void> {
  app = await electron.launch({
    args: ['out/main/index.js', `--user-data-dir=${userDataDir}`],
  });
  page = await app.firstWindow();
  await page.waitForSelector('[data-testid="rail"]');
  await page.getByRole('button', { name: 'Study' }).click();
  await page.waitForSelector('.tabgroup');
}

test.beforeEach(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'versescape-sync-'));
  await launch();
});

test.afterEach(async () => {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

const readers = () => page.locator('.bible-panel');

async function openReader(): Promise<void> {
  await page.getByRole('button', { name: 'Open a reader' }).click();
  await expect(readers().first()).toBeVisible();
}

test('typing a reference navigates the panel', async () => {
  await openReader();

  await page.locator('.reference__input').fill('Ezra 1:5');
  await page.locator('.reference__input').press('Enter');

  await expect(page.locator('.bible-panel__heading')).toHaveText('Ezra 1');
  await expect(page.locator('.reference__input')).toHaveValue('Ezra 1:5');
});

test('an abbreviation is expanded to the full book name', async () => {
  await openReader();

  await page.locator('.reference__input').fill('jn 3:16');
  await page.locator('.reference__input').press('Enter');

  await expect(page.locator('.reference__input')).toHaveValue('John 3:16');
});

test('an invalid reference is rejected without navigating', async () => {
  await openReader();
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 3');

  await page.locator('.reference__input').fill('Hezekiah 3:1');
  await page.locator('.reference__input').press('Enter');

  await expect(page.locator('.reference__input')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 3');
});

test('the book autocomplete suggests matches', async () => {
  await openReader();
  await page.locator('.reference__input').fill('ezr');

  await expect(page.getByRole('option', { name: /Ezra/ })).toBeVisible();
});

test('navigating one panel moves its sync partner', async () => {
  // Two readers side by side, both in set A.
  await openReader();
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await page.getByRole('button', { name: 'Open a reader' }).click();
  await expect(readers()).toHaveCount(2);

  for (const index of [0, 1]) {
    await page.locator('.syncpicker__trigger').nth(index).click();
    await page.getByRole('menuitem', { name: 'Set A' }).click();
  }
  await expect(page.locator('.tab__sync')).toHaveCount(2);

  const first = page.locator('.reference__input').first();
  await first.fill('Ezra 1:5');
  await first.press('Enter');

  // The partner follows into the same chapter.
  await expect(page.locator('.bible-panel__heading').nth(1)).toHaveText('Ezra 1');
});

test('an unsynced panel does not follow', async () => {
  await openReader();
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await page.getByRole('button', { name: 'Open a reader' }).click();
  await expect(readers()).toHaveCount(2);

  // Only the first joins a set.
  await page.locator('.syncpicker__trigger').first().click();
  await page.getByRole('menuitem', { name: 'Set A' }).click();

  const first = page.locator('.reference__input').first();
  await first.fill('Ezra 1:5');
  await first.press('Enter');

  await expect(page.locator('.bible-panel__heading').first()).toHaveText('Ezra 1');
  await expect(page.locator('.bible-panel__heading').nth(1)).toHaveText('John 3');
});

test('panels in different sets stay independent', async () => {
  await openReader();
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await page.getByRole('button', { name: 'Open a reader' }).click();

  await page.locator('.syncpicker__trigger').first().click();
  await page.getByRole('menuitem', { name: 'Set A' }).click();
  await page.locator('.syncpicker__trigger').nth(1).click();
  await page.getByRole('menuitem', { name: 'Set B' }).click();

  const first = page.locator('.reference__input').first();
  await first.fill('Ezra 1:5');
  await first.press('Enter');

  await expect(page.locator('.bible-panel__heading').nth(1)).toHaveText('John 3');
});

test('the layout survives a restart', async () => {
  await openReader();
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await page.getByRole('button', { name: 'New Panel' }).click();
  await page.getByRole('menuitem', { name: 'Scratch' }).click();
  await page.locator('.scratch-panel__input').fill('persisted text');

  await expect(page.locator('.tabgroup')).toHaveCount(2);

  // Give the debounced autosave time to land.
  await page.waitForTimeout(900);
  await app.close();
  await launch();

  await expect(page.locator('.tabgroup')).toHaveCount(2);
  await expect(page.locator('.scratch-panel__input')).toHaveValue('persisted text');
});

test('a reference survives a restart', async () => {
  await openReader();
  await page.locator('.reference__input').fill('Ezra 1:5');
  await page.locator('.reference__input').press('Enter');

  await page.waitForTimeout(900);
  await app.close();
  await launch();

  await expect(page.locator('.bible-panel__heading')).toHaveText('Ezra 1');
});

test('renders real Scripture and switches translation', async () => {
  await openReader();
  const reference = page.locator('.reference__input');
  await reference.fill('John 3:16');
  await reference.press('Enter');

  const current = page.locator('.bible-panel__verse--current');
  await expect(current).toContainText('For God so loved the world');
  await expect(current).toContainText('one and only');

  await page.getByLabel('Translation').selectOption('kjv');
  await expect(current).toContainText('whosoever believeth in him');
});

test('virtualizes a long chapter and scrolls directly to an unmounted verse', async () => {
  await openReader();
  const reference = page.locator('.reference__input');
  await reference.fill('Psalm 119:176');
  await reference.press('Enter');

  await expect(page.locator('[data-verse="19119176"]')).toBeVisible();
  expect(await page.locator('.bible-panel__verse').count()).toBeLessThan(40);
});

test('scrolling forward automatically appends the next chapter', async () => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await openReader();
  const scroll = page.getByTestId('bible-scroll');

  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator('.bible-panel__virtual')).toHaveAttribute(
    'data-loaded-chapters',
    '3,4,5',
  );
  await expect(page.locator('.bible-panel__virtual')).toHaveAttribute('data-restoring', 'false');
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(page.locator('[data-verse^="43005"]').first()).toBeVisible();
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 5');
  await expect(page.locator('.reference__input')).toHaveValue(/John 5:/);
  expect(await page.locator('.bible-panel__verse').count()).toBeLessThan(40);
  expect(consoleErrors).toEqual([]);
});

test('scrolling backward prepends a chapter without losing the visible anchor', async () => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await openReader();
  const scroll = page.getByTestId('bible-scroll');

  await scroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.locator('.bible-panel__virtual')).toHaveAttribute(
    'data-loaded-chapters',
    '1,2,3',
  );
  await expect(page.locator('.bible-panel__virtual')).toHaveAttribute('data-restoring', 'false');

  // Chapter 1 was prepended, but the reader remains anchored in chapter 2.
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 2');
  await scroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.locator('[data-verse="43001001"]')).toBeVisible();
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 1');
  await expect(page.locator('.reference__input')).toHaveValue(/John 1:/);
  expect(await page.locator('.bible-panel__verse').count()).toBeLessThan(40);
  expect(consoleErrors).toEqual([]);
});

test('continuous reading stops at book boundaries', async () => {
  await openReader();
  const reference = page.locator('.reference__input');
  await reference.fill('Jude 1');
  await reference.press('Enter');

  const scroll = page.getByTestId('bible-scroll');
  await expect(page.locator('.bible-panel__virtual')).toHaveAttribute('data-loaded-chapters', '1');
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator('.bible-panel__heading')).toHaveText('Jude 1');
  await expect(page.locator('.bible-panel__virtual')).toHaveAttribute('data-loaded-chapters', '1');
});
