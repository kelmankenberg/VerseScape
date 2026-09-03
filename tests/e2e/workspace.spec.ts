import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeEach(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'versescape-ws-'));
  app = await electron.launch({
    args: ['out/main/index.js', `--user-data-dir=${userDataDir}`],
  });
  page = await app.firstWindow();
  await page.waitForSelector('[data-testid="rail"]');
  await page.getByRole('button', { name: 'Study' }).click();
  await page.waitForSelector('.tabgroup');
});

test.afterEach(async () => {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

const groups = () => page.locator('.tabgroup');
const tabs = () => page.locator('.tab');

test('opens with a single empty group offering a way forward', async () => {
  await expect(groups()).toHaveCount(1);
  await expect(tabs()).toHaveCount(1);
  await expect(page.getByText('This panel is empty.')).toBeVisible();
});

test('the empty state replaces itself with a real panel', async () => {
  await page.getByRole('button', { name: 'Open a reader' }).click();

  await expect(tabs()).toHaveCount(1);
  await expect(tabs().first()).toContainText('BSB');
  await expect(page.locator('.bible-panel')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Bible contents' })).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Bible contents' })
    .getByRole('button', { name: 'Genesis', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Bible contents' })
    .locator('.bible-panel__contents-book')
    .filter({ hasText: 'Genesis' })
    .getByRole('button', { name: 'Chapter 2', exact: true })
    .click();
  await expect(page.locator('.bible-panel__heading')).toHaveText('Genesis 2');
});

test('New Panel adds a tab to the focused group', async () => {
  await page.getByRole('button', { name: 'New Panel' }).click();
  await page.getByRole('menuitem', { name: 'Scratch' }).click();

  await expect(tabs()).toHaveCount(2);
  await expect(groups()).toHaveCount(1);
  await expect(page.locator('.scratch-panel')).toBeVisible();
});

test('Passage Compare renders installed translations and follows header navigation', async () => {
  await page.getByRole('button', { name: 'New Panel' }).click();
  await page.getByRole('menuitem', { name: 'Passage Compare' }).click();

  await expect(page.locator('.compare-panel')).toBeVisible();
  await expect(page.locator('.compare-panel__column')).toHaveCount(2);
  await expect(page.locator('.compare-panel__translation')).toContainText(['BSB', 'KJV']);
  await expect(page.locator('.compare-panel__heading')).toHaveText('John 3');

  const referenceInput = page.getByRole('textbox', { name: 'Go to reference' });
  await referenceInput.fill('Jude 1:1');
  await referenceInput.press('Enter');

  await expect(page.locator('.compare-panel__heading')).toHaveText('Jude 1');
  await expect(page.locator('.compare-panel__column')).toHaveCount(2);
});

test('splitting creates a second group with a splitter between', async () => {
  await page.getByTitle('Split right (Ctrl+\\)').click();

  await expect(groups()).toHaveCount(2);
  await expect(page.locator('.splitter--row')).toHaveCount(1);
});

test('splitting down uses a column split', async () => {
  await page.getByTitle('Split down (Ctrl+Shift+\\)').click();

  await expect(groups()).toHaveCount(2);
  await expect(page.locator('.splitter--column')).toHaveCount(1);
});

test('closing the last tab in a group collapses the split', async () => {
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await expect(groups()).toHaveCount(2);

  await groups().nth(1).locator('.tab__close').first().click();

  await expect(groups()).toHaveCount(1);
  await expect(page.locator('.splitter')).toHaveCount(0);
});

test('panel state survives switching tabs', async () => {
  await page.getByRole('button', { name: 'New Panel' }).click();
  await page.getByRole('menuitem', { name: 'Scratch' }).click();
  await page.locator('.scratch-panel__input').fill('remember me');

  await tabs().first().click();
  await expect(page.locator('.scratch-panel')).toHaveCount(0);

  await tabs().nth(1).click();
  await expect(page.locator('.scratch-panel__input')).toHaveValue('remember me');
});

test('a sync set can be assigned and shows on the tab', async () => {
  await page.getByRole('button', { name: 'Open a reader' }).click();
  await page.locator('.syncpicker__trigger').click();
  await page.getByRole('menuitem', { name: 'Set A' }).click();

  await expect(page.locator('.tab__sync')).toHaveText('A');
});

test('dragging a splitter changes the pane sizes', async () => {
  await page.getByTitle('Split right (Ctrl+\\)').click();

  const firstPane = page.locator('.split__pane').first();
  const before = (await firstPane.boundingBox())!.width;

  const splitter = page.locator('.splitter--row');
  const box = (await splitter.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const after = (await firstPane.boundingBox())!.width;
  expect(after).toBeGreaterThan(before + 100);
});

test('dragging a tab onto another group’s edge splits it', async () => {
  await page.getByRole('button', { name: 'New Panel' }).click();
  await page.getByRole('menuitem', { name: 'Scratch' }).click();
  await expect(tabs()).toHaveCount(2);

  const source = tabs().nth(1);
  const target = groups().first();
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Past the 4px activation distance first, then into the bottom edge zone.
  await page.mouse.move(sourceBox.x + 40, sourceBox.y + 40, { steps: 5 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * 0.9, {
    steps: 10,
  });
  await page.mouse.up();

  await expect(groups()).toHaveCount(2);
  await expect(page.locator('.splitter--column')).toHaveCount(1);
});

test('keyboard shortcuts open, split and close', async () => {
  await page.keyboard.press('Control+\\');
  await expect(groups()).toHaveCount(2);

  await page.keyboard.press('Control+t');
  await expect(tabs()).toHaveCount(3);

  await page.keyboard.press('Control+w');
  await expect(tabs()).toHaveCount(2);

  await page.keyboard.press('Control+Shift+z');
  await expect(tabs()).toHaveCount(3);
});
