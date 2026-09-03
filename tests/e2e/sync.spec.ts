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

test('a primary-button text selection opens a toolbar that copies and dismisses', async () => {
  await openReader();

  const verse = page.locator('.bible-panel__verse').first();
  const selectedText = await verse.evaluate((element) => {
    const document = element.ownerDocument;
    const walker = document.createTreeWalker(element, 4);
    let text = walker.nextNode();
    while (text && !text.textContent?.trim()) text = walker.nextNode();
    if (!text) throw new Error('Expected Scripture text.');
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(text);
    const selection = document.defaultView?.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return range.toString().trim();
  });
  expect(selectedText).not.toBe('');
  await verse.dispatchEvent('mouseup', { button: 0 });

  const toolbar = page.getByRole('toolbar', { name: 'Selection actions' });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Styled' })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Copy' }).click();
  await expect(toolbar.getByRole('button', { name: 'Copied' })).toBeVisible();

  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied.length).toBeGreaterThan(0);

  await page.keyboard.press('Escape');
  await expect(toolbar).toHaveCount(0);
});

test('a selected KJV word opens and reuses the Strong\'s panel', async () => {
  await openReader();
  await page.locator('.reference__input').fill('John 3:16');
  await page.locator('.reference__input').press('Enter');
  await page.locator('.bible-panel__translation').selectOption('kjv');
  const targetVerse = page.locator('.bible-panel__verse').filter({ hasText: 'God' }).first();
  await expect(targetVerse).toContainText('God');

  const selectWord = async (word: string): Promise<void> => {
    const verse = targetVerse;
    await verse.evaluate((element, targetWord) => {
      const walker = element.ownerDocument.createTreeWalker(element, 4);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? '';
        const start = text.indexOf(targetWord);
        if (start < 0) continue;
        const range = element.ownerDocument.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + targetWord.length);
        const selection = element.ownerDocument.defaultView?.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        const MouseEventConstructor = element.ownerDocument.defaultView?.MouseEvent;
        if (MouseEventConstructor) {
          element.dispatchEvent(new MouseEventConstructor('mouseup', { bubbles: true, button: 0 }));
        }
        return;
      }
      throw new Error(`Could not find ${targetWord}.`);
    }, word);
  };

  await selectWord('God');
  let toolbar = page.getByRole('toolbar', { name: 'Selection actions' });
  await expect(toolbar.getByRole('button', { name: "Strong's" })).toBeEnabled();
  await toolbar.getByRole('button', { name: "Strong's" }).click();
  await expect(page.locator('.strongs-panel__title')).toHaveText("Strong's G2316");
  await expect(page.locator('.strongs-panel__definition')).toContainText('God');
  await expect(page.locator('.strongs-panel')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Bible' }).click();
  await expect(targetVerse).toBeVisible();
  await selectWord('loved');
  toolbar = page.getByRole('toolbar', { name: 'Selection actions' });
  await toolbar.getByRole('button', { name: "Strong's" }).click();
  await expect(page.locator('.strongs-panel__title')).toHaveText("Strong's G0025");
  await expect(page.locator('.strongs-panel')).toHaveCount(1);
});

test('clicking a word highlights every visible instance and replaces the previous highlight', async () => {
  await openReader();
  await page.locator('.reference__input').fill('John 3:16');
  await page.locator('.reference__input').press('Enter');
  await page.locator('.bible-panel__translation').selectOption('kjv');
  await page.waitForTimeout(550);

  const targetVerse = page.locator('.bible-panel__verse--current');
  await expect(targetVerse).toBeVisible();
  await expect(targetVerse).toContainText('God');
  const godWords = page.locator('[data-word="god"]');
  expect(await godWords.count()).toBeGreaterThan(1);

  await targetVerse.locator('[data-word="god"]').first().click();
  await expect(page.locator('.reference__input')).toHaveValue('John 3:16');
  const highlightedGod = page.locator('[data-word="god"].bible-text__word-highlight');
  await expect
    .poll(async () => (await highlightedGod.count()) === (await godWords.count()))
    .toBe(true);

  await page.locator('.reference__input').fill('John 3:19');
  await page.locator('.reference__input').press('Enter');
  await page.waitForTimeout(550);
  const lightVerse = page.locator('.bible-panel__verse--current');
  await expect(lightVerse).toContainText('light');
  const lightWords = page.locator('[data-word="light"]');
  await lightVerse.locator('[data-word="light"]').first().click();
  await expect(page.locator('[data-word="god"].bible-text__word-highlight')).toHaveCount(0);
  await expect
    .poll(async () => {
      const highlightedLight = page.locator('[data-word="light"].bible-text__word-highlight');
      return (await highlightedLight.count()) === (await lightWords.count());
    })
    .toBe(true);
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

test('opens ranked cross-references and navigates to one', async () => {
  await openReader();
  const reference = page.locator('.reference__input');
  await reference.fill('Genesis 1:1');
  await reference.press('Enter');

  const current = page.locator('.bible-panel__verse--current');
  await expect(current).toHaveAttribute('data-verse', '1001001');
  await current.getByRole('button', { name: 'Cross references' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cross references' });
  await expect(dialog).toBeVisible();
  const first = dialog.locator('.crossrefs__item').first();
  await expect(first).toHaveText('John 1:1-3');
  await first.click();

  await expect(page.locator('.bible-panel__heading')).toHaveText('John 1');
  await expect(reference).toHaveValue('John 1:1');
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
  await page.waitForTimeout(550);

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
  await page.waitForTimeout(550);

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

test('per-panel display options override the global default without affecting other panels', async () => {
  await openReader();
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await page.getByRole('button', { name: 'Open a reader' }).click();
  await expect(readers()).toHaveCount(2);

  for (const index of [0, 1]) {
    const referenceInput = page.locator('.reference__input').nth(index);
    await referenceInput.fill('John 3:16');
    await referenceInput.press('Enter');
  }

  const first = readers().first();
  const second = readers().nth(1);

  // Words of Christ are red by default.
  await expect(first.locator('.bible-text__words').first()).toBeVisible();
  await expect(first).toHaveClass(/bible-panel--red-letter/);

  await first.getByRole('button', { name: 'Display options' }).click();
  await page.getByRole('checkbox', { name: 'Red letter' }).uncheck({ force: true });
  await page.getByRole('checkbox', { name: 'Section headings' }).uncheck({ force: true });
  await page.getByRole('checkbox', { name: 'Cross references' }).uncheck({ force: true });
  await page.getByRole('checkbox', { name: 'Verse per line' }).uncheck({ force: true });
  await page.keyboard.press('Escape');

  await expect(first).not.toHaveClass(/bible-panel--red-letter/);
  await expect(first).toHaveClass(/bible-panel--paragraph/);
  await expect(first.locator('.bible-panel__section')).toHaveCount(0);
  await expect(first.getByRole('button', { name: 'Cross references' })).toHaveCount(0);

  // The second panel, and the global default, are untouched.
  await expect(second).toHaveClass(/bible-panel--red-letter/);
  await expect(second).not.toHaveClass(/bible-panel--paragraph/);
  await expect(second.getByRole('button', { name: 'Cross references' }).first()).toBeVisible();
});

test('the Settings reading defaults apply to newly opened panels', async () => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'Footnotes' }).uncheck({ force: true });
  await page.getByRole('button', { name: 'Study' }).click();
  await page.waitForSelector('.tabgroup');

  await openReader();
  await page.locator('.reference__input').fill('Jude 1:1');
  await page.locator('.reference__input').press('Enter');

  await expect(page.locator('.bible-text__note')).toHaveCount(0);
});

test('arrow keys navigate verse by verse', async () => {
  await openReader();
  const reference = page.locator('.reference__input');

  await reference.fill('John 3:16');
  await reference.press('Enter');
  await expect(reference).toHaveValue('John 3:16');

  // Arrow down should navigate to the next verse
  await page.keyboard.press('ArrowDown');
  await expect(reference).toHaveValue('John 3:17', { timeout: 5000 });

  // Arrow down again
  await page.keyboard.press('ArrowDown');
  await expect(reference).toHaveValue('John 3:18', { timeout: 5000 });

  // Arrow up should navigate to the previous verse
  await page.keyboard.press('ArrowUp');
  await expect(reference).toHaveValue('John 3:17', { timeout: 5000 });

  // Arrow up again
  await page.keyboard.press('ArrowUp');
  await expect(reference).toHaveValue('John 3:16', { timeout: 5000 });
});

test('Page Down/Up navigate chapter by chapter', async () => {
  await openReader();
  const reference = page.locator('.reference__input');

  await reference.fill('John 3:16');
  await reference.press('Enter');
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 3');
  await expect(page.locator('[data-verse="43003016"]')).toBeVisible();

  // Page Down should navigate to the first verse of the next chapter
  await page.keyboard.press('PageDown');
  await expect(reference).toHaveValue(/John 4:/, { timeout: 5000 });
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 4', { timeout: 5000 });

  // Wait for the chapter to be fully loaded before next key press
  await page.waitForTimeout(200);

  // Page Down again
  await page.keyboard.press('PageDown');
  await expect(reference).toHaveValue(/John 5:/, { timeout: 5000 });
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 5', { timeout: 5000 });

  // Wait before Page Up
  await page.waitForTimeout(200);

  // Page Up should navigate to the first verse of the previous chapter
  await page.keyboard.press('PageUp');
  await expect(reference).toHaveValue(/John 4:/, { timeout: 5000 });
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 4', { timeout: 5000 });

  // Wait before final Page Up
  await page.waitForTimeout(200);

  // Page Up again
  await page.keyboard.press('PageUp');
  await expect(reference).toHaveValue(/John 3:/, { timeout: 5000 });
  await expect(page.locator('.bible-panel__heading')).toHaveText('John 3', { timeout: 5000 });
});

test('keyboard navigation handles chapter boundaries', async () => {
  await openReader();
  const reference = page.locator('.reference__input');

  // Navigate to the first verse of a chapter
  await reference.fill('John 3:1');
  await reference.press('Enter');
  await expect(reference).toHaveValue('John 3:1');

  // Wait for the verse to be visible (ensures chapter is loaded)
  await expect(page.locator('[data-verse="43003001"]')).toBeVisible();
  
  // Give the chapter data a moment to be processed
  await page.waitForTimeout(200);

  // Arrow down should navigate forward (should work after chapter is loaded)
  await page.keyboard.press('ArrowDown');
  await expect(reference).toHaveValue('John 3:2', { timeout: 5000 });

  // Arrow down again
  await page.keyboard.press('ArrowDown');
  await expect(reference).toHaveValue('John 3:3', { timeout: 5000 });
});

test('keyboard navigation publishes to sync sets', async () => {
  // Two readers in the same sync set
  await openReader();
  await page.getByTitle('Split right (Ctrl+\\)').click();
  await page.getByRole('button', { name: 'Open a reader' }).click();
  await expect(readers()).toHaveCount(2);

  for (const index of [0, 1]) {
    await page.locator('.syncpicker__trigger').nth(index).click();
    await page.getByRole('menuitem', { name: 'Set A' }).click();
  }
  await expect(page.locator('.tab__sync')).toHaveCount(2);

  const scroll = page.getByTestId('bible-scroll').first();
  await scroll.focus();

  // Arrow down on the first reader
  await page.keyboard.press('ArrowDown');

  // Both readers should update
  await expect(page.locator('.reference__input').first()).toHaveValue('John 3:2');
  await expect(page.locator('.reference__input').nth(1)).toHaveValue('John 3:2');
});
