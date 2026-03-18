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

test('search engine should switch via dropdown', async () => {
  test.setTimeout(120000);

  const extPath = path.resolve(__dirname, '..');
  const userDataDir = path.resolve(__dirname, '..', '.tmp', 'pw-search-engine-profile');
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
  await page.waitForTimeout(1500);

  await page.click('.search-icon-container');
  await page.waitForTimeout(300);

  const dropdownVisible = await page.evaluate(() => {
    const dd = document.querySelector('.search-engine-dropdown');
    return !!dd && getComputedStyle(dd).display !== 'none';
  });
  test.expect(dropdownVisible, 'Search engine dropdown should open').toBeTruthy();

  const switched = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('.search-engine-option'));
    const target = options.find((item) => {
      const label = item.querySelector('.search-engine-option-label')?.textContent?.toLowerCase() || '';
      return label.includes('bing') || label.includes('必应');
    });
    if (!target) {
      return { ok: false, reason: 'bing option not found' };
    }
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const selected = localStorage.getItem('selectedSearchEngine');
    const iconSrc = document.getElementById('search-engine-icon')?.getAttribute('src') || '';
    const ok = selected === 'bing' && iconSrc.includes('bing-logo');
    return { ok, selected, iconSrc, reason: ok ? '' : 'selected/icon not updated' };
  });

  console.log('SEARCH_SWITCH_RESULT', JSON.stringify(switched));
  console.log('SEARCH_SWITCH_ERRORS', errors.length);
  for (const err of errors.slice(0, 100)) console.log('ERR:', err);

  await context.close();

  test.expect(errors, 'Switching search engine should not throw runtime errors').toEqual([]);
  test.expect(switched.ok, switched.reason || 'Search engine switch failed').toBeTruthy();
});
