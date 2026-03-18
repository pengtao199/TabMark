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

test('special links should open internal pages', async () => {
  test.setTimeout(120000);

  const extPath = path.resolve(__dirname, '..');
  const userDataDir = path.resolve(__dirname, '..', '.tmp', 'pw-special-links-profile');
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

  const links = ['#history-link', '#downloads-link', '#passwords-link', '#extensions-link'];
  const beforePages = context.pages().length;

  for (const selector of links) {
    await page.click(selector);
    await page.waitForTimeout(350);
  }

  const afterPages = context.pages().length;
  const openedCount = afterPages - beforePages;

  console.log('SPECIAL_LINKS_OPENED', openedCount);
  console.log('SPECIAL_LINKS_ERRORS', errors.length);
  for (const err of errors.slice(0, 100)) console.log('ERR:', err);

  await context.close();

  test.expect(errors, 'Clicking special links should not throw runtime errors').toEqual([]);
  test.expect(openedCount, 'Clicking 4 special links should open additional pages').toBeGreaterThanOrEqual(3);
});
