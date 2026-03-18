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

test('settings regression', async () => {
  test.setTimeout(120000);

  const extPath = path.resolve(__dirname, '..');
  const userDataDir = path.resolve(__dirname, '..', '.tmp', 'pw-settings-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const errors = [];
  const warnings = [];

  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
    if (m.type() === 'warning') warnings.push(`[console.warn] ${m.text()}`);
  });

  const extensionId = await waitForExtensionId(context);
  await page.goto(`chrome-extension://${extensionId}/src/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const trigger = document.getElementById('settings-link');
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const openState = await page.evaluate(() => {
    const sidebar = document.getElementById('settings-sidebar');
    return !!sidebar && sidebar.classList.contains('open');
  });
  test.expect(openState, 'Settings sidebar should open').toBeTruthy();

  const tabScan = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.settings-tab-button'));
    return buttons.map((btn) => {
      const tab = btn.getAttribute('data-tab');
      const content = document.getElementById(`${tab}-settings`);
      return {
        tab,
        hasContent: !!content,
      };
    });
  });

  const tabResults = await page.evaluate((tabs) => {
    const results = [];
    for (const tab of tabs) {
      const btn = document.querySelector(`.settings-tab-button[data-tab="${tab.tab}"]`);
      const content = document.getElementById(`${tab.tab}-settings`);
      if (!btn || !content) {
        results.push({ tab: tab.tab, ok: false, reason: 'missing button/content' });
        continue;
      }
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const ok = btn.classList.contains('active') && content.classList.contains('active');
      results.push({ tab: tab.tab, ok, reason: ok ? '' : 'active state not switched' });
    }
    return results;
  }, tabScan);

  for (const tab of tabScan) {
    test.expect(tab.hasContent, `Tab ${tab.tab} should have corresponding content`).toBeTruthy();
  }
  for (const row of tabResults) {
    test.expect(row.ok, `Tab ${row.tab} should switch active state correctly (${row.reason})`).toBeTruthy();
  }

  const selectorsToToggle = [
    '#show-search-box',
    '#show-welcome-message',
    '#show-footer',
    '#show-history-suggestions',
    '#show-bookmark-suggestions',
    '#enable-floating-ball',
    '#enable-quick-links',
    '#open-in-new-tab',
    '#sidepanel-open-in-new-tab',
    '#sidepanel-open-in-sidepanel',
    '#enable-wheel-switching',
    '#open-search-in-new-tab',
  ];

  await page.evaluate((selectors) => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selectorsToToggle);

  const sliders = ['#width-slider', '#height-slider', '#container-width-slider'];
  await page.evaluate((sliderSelectors) => {
    for (const slider of sliderSelectors) {
      const input = document.querySelector(slider);
      if (!input) continue;
      const max = Number(input.max || 100);
      const min = Number(input.min || 0);
      const mid = Math.round((max + min) / 2);
      input.value = String(mid);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, sliders);
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const overlay = document.getElementById('settings-overlay');
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(250);

  const closeState = await page.evaluate(() => {
    const sidebar = document.getElementById('settings-sidebar');
    return !sidebar || !sidebar.classList.contains('open');
  });
  test.expect(closeState, 'Settings sidebar should close by overlay click').toBeTruthy();

  console.log('SETTINGS_TABS', JSON.stringify(tabScan));
  console.log('SETTINGS_TAB_RESULTS', JSON.stringify(tabResults));
  console.log('SETTINGS_ERRORS', errors.length);
  for (const err of errors.slice(0, 200)) console.log('ERR:', err);
  console.log('SETTINGS_WARNINGS', warnings.length);

  await context.close();
  test.expect(errors, 'Settings interactions should not throw runtime errors').toEqual([]);
});
