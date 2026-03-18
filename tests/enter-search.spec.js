const { test, chromium } = require('@playwright/test');
const path = require('path');

async function waitForExtensionId(context, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sw of context.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Cannot resolve extension id');
}

test('press Enter in search input should trigger search', async () => {
  test.setTimeout(120000);

  const extPath = path.resolve(__dirname, '..');
  const userDataDir = path.resolve(__dirname, '..', '.tmp', 'pw-enter-search-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
  });

  const extensionId = await waitForExtensionId(context);
  await page.goto(`chrome-extension://${extensionId}/src/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(1200);

  // Force new-tab open mode for predictable assertion.
  await page.evaluate(() => {
    chrome.storage.sync.set({ openSearchInNewTab: true });
  });

  const beforePages = context.pages().length;
  await page.fill('.search-input', 'openai');
  await page.press('.search-input', 'Enter');
  await page.waitForTimeout(600);

  const afterPages = context.pages().length;
  const opened = afterPages - beforePages;
  const state = await page.evaluate(() => ({
    trigger: window.__tabmarkSearchSubmitTriggered || null,
    url: window.__tabmarkLastSearchUrl || '',
    pageHref: location.href
  }));
  const navigatedInSameTab = /^https?:\/\//.test(state.pageHref);
  const openedOrNavigated = opened >= 1 || navigatedInSameTab;

  console.log('ENTER_SEARCH_OPENED', opened);
  console.log('ENTER_SEARCH_STATE', JSON.stringify(state));
  console.log('ENTER_SEARCH_ERRORS', errors.length);
  for (const err of errors.slice(0, 100)) console.log('ERR:', err);

  await context.close();

  test.expect(errors, 'Enter search should not throw runtime errors').toEqual([]);
  test.expect(state.trigger, 'Enter should trigger search handler').toBe('enter');
  test.expect(state.url.includes('openai'), 'Enter should build search URL with query').toBeTruthy();
  test.expect(openedOrNavigated, 'Pressing Enter should open a result page or navigate current page').toBeTruthy();
});
