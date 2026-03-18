const { test, chromium } = require('@playwright/test');
const path = require('path');

async function waitForExtensionId(context, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const bgPages = context.backgroundPages();
    for (const p of bgPages) {
      const m = p.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (m) return m[1];
    }

    for (const sw of context.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (m) return m[1];
    }

    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Cannot resolve extension id from service worker/background pages');
}

test('newtab smoke', async () => {
  test.setTimeout(90000);
  const extPath = path.resolve(__dirname, '..');
  const userDataDir = path.resolve(__dirname, '..', '.tmp', 'pw-newtab-profile');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const errors = [];
  const logs = [];

  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
    if (m.type() === 'warning') logs.push(`[console.warn] ${m.text()}`);
  });

  // Open extension newtab page directly.
  let extensionId = '';
  try {
    extensionId = await waitForExtensionId(context);
    await page.goto(`chrome-extension://${extensionId}/src/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
  } catch (e) {
    errors.push(`[resolve-extension-failed] ${e.message}`);
  }

  await page.waitForTimeout(3000);

  // Seed one folder + one bookmark to verify read/render chain.
  const seedInfo = await page.evaluate(async () => {
    const withTimeout = (promise, ms, label) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
      ]);

    const create = (arg) => new Promise((resolve, reject) => {
      chrome.bookmarks.create(arg, (node) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(node);
      });
    });
    const getChildren = (id) => new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(id, (nodes) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(nodes);
      });
    });

    const folder = await withTimeout(create({ parentId: '1', title: '__tabmark_smoke_folder__' }), 8000, 'create-folder');
    const link = await withTimeout(create({ parentId: '1', title: '__tabmark_smoke_link__', url: 'https://example.com/' }), 8000, 'create-link');
    const children = await withTimeout(getChildren('1'), 8000, 'get-children');

    if (globalThis.__tabmarkScript?.updateBookmarksDisplay) {
      globalThis.__tabmarkScript.updateBookmarksDisplay('1');
    }
    if (globalThis.__tabmarkScript?.updateBookmarkCards) {
      globalThis.__tabmarkScript.updateBookmarkCards();
    }

    return {
      folderId: folder.id,
      linkId: link.id,
      rootChildrenCount: children.length,
    };
  });

  await page.waitForTimeout(2000);

  const welcomeState = await page.evaluate(() => {
    const el = document.getElementById('welcome-message');
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      text: (el.textContent || '').trim(),
      display: style.display,
      visibility: style.visibility,
    };
  });
  test.expect(welcomeState, 'Welcome message element should exist').toBeTruthy();
  test.expect(welcomeState.visibility, 'Welcome message should not stay hidden').toBe('visible');
  test.expect(welcomeState.display, 'Welcome message should be displayed by default').not.toBe('none');
  test.expect(welcomeState.text.length, 'Welcome message text should be rendered').toBeGreaterThan(0);

  // Context menu open/close flow check.
  const firstBookmarkCard = page.locator('.bookmark-card').first();
  if (await firstBookmarkCard.count()) {
    await firstBookmarkCard.click({ button: 'right' });
    await page.waitForTimeout(200);
    const bookmarkMenuVisible = await page.evaluate(() => {
      const menu = document.querySelector('.custom-context-menu');
      return !!menu && getComputedStyle(menu).display !== 'none';
    });
    test.expect(bookmarkMenuVisible, 'Bookmark context menu should open').toBeTruthy();

    await page.mouse.click(20, 20, { button: 'left' });
    await page.waitForTimeout(200);
    const bookmarkMenuClosed = await page.evaluate(() => {
      const menu = document.querySelector('.custom-context-menu');
      return !menu || getComputedStyle(menu).display === 'none';
    });
    test.expect(bookmarkMenuClosed, 'Bookmark context menu should close when clicking blank area').toBeTruthy();
  }

  const firstFolderCard = page.locator('.bookmark-folder').first();
  if (await firstFolderCard.count()) {
    await firstFolderCard.click({ button: 'right' });
    await page.waitForTimeout(200);
    const folderMenuVisible = await page.evaluate(() => {
      const menu = document.querySelector('.bookmark-folder-context-menu');
      return !!menu && getComputedStyle(menu).display !== 'none';
    });
    test.expect(folderMenuVisible, 'Folder context menu should open').toBeTruthy();

    await page.mouse.click(20, 20, { button: 'left' });
    await page.waitForTimeout(200);
    const folderMenuClosed = await page.evaluate(() => {
      const menu = document.querySelector('.bookmark-folder-context-menu');
      return !menu || getComputedStyle(menu).display === 'none';
    });
    test.expect(folderMenuClosed, 'Folder context menu should close when clicking blank area').toBeTruthy();
  }

  const snapshot = await page.evaluate(() => {
    const list = document.getElementById('bookmarks-list');
    const cards = document.querySelectorAll('.bookmark-card').length;
    const folders = document.querySelectorAll('.bookmark-folder').length;
    const placeholders = document.querySelectorAll('.bookmark-placeholder').length;
    return {
      url: location.href,
      parentId: list?.dataset?.parentId || null,
      cardCount: cards,
      folderCount: folders,
      placeholderCount: placeholders,
      listTextSample: list ? list.textContent.slice(0, 120) : null,
    };
  });

  console.log('SMOKE_URL', snapshot.url);
  console.log('BOOKMARK_SEED', JSON.stringify(seedInfo));
  console.log('BOOKMARK_DOM', JSON.stringify(snapshot));
  console.log('RUNTIME_ERRORS', errors.length);
  for (const err of errors.slice(0, 200)) console.log('ERR:', err);

  console.log('RUNTIME_WARNINGS', logs.length);
  for (const line of logs.slice(0, 80)) console.log('WARN:', line);

  await context.close();

  // Keep test failing when runtime errors exist so we can iterate by test.
  test.expect(errors, 'Runtime errors should be empty').toEqual([]);
});
