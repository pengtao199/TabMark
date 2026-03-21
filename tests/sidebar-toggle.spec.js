const { test, chromium } = require('@playwright/test');
const path = require('path');

async function waitForExtensionId(context, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const p of context.backgroundPages()) {
      const m = p.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (m) return m[1];
    }
    for (const sw of context.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Cannot resolve extension id');
}

test('sidebar toggle button should expand/collapse sidebar', async () => {
  test.setTimeout(90000);
  const extPath = path.resolve(__dirname, '..');
  const userDataDir = path.resolve(__dirname, '..', '.tmp', 'pw-sidebar-profile');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
  });

  const extensionId = await waitForExtensionId(context);
  await page.goto(`chrome-extension://${extensionId}/src/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar-container');
    const btn = document.getElementById('toggle-sidebar');
    return {
      collapsed: sidebar?.classList.contains('collapsed') || false,
      btnText: btn?.textContent?.trim() || '',
    };
  });

  await page.click('#toggle-sidebar');
  await page.waitForTimeout(200);

  const afterFirstClick = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar-container');
    const btn = document.getElementById('toggle-sidebar');
    return {
      collapsed: sidebar?.classList.contains('collapsed') || false,
      btnText: btn?.textContent?.trim() || '',
    };
  });

  await page.click('#toggle-sidebar');
  await page.waitForTimeout(200);

  const afterSecondClick = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar-container');
    return {
      collapsed: sidebar?.classList.contains('collapsed') || false,
    };
  });

  console.log('SIDEBAR_BEFORE', JSON.stringify(before));
  console.log('SIDEBAR_AFTER_1', JSON.stringify(afterFirstClick));
  console.log('SIDEBAR_AFTER_2', JSON.stringify(afterSecondClick));
  console.log('SIDEBAR_ERRORS', errors.length);
  for (const err of errors.slice(0, 50)) console.log('ERR:', err);

  await context.close();

  test.expect(errors).toEqual([]);
  test.expect(afterFirstClick.collapsed).toBe(!before.collapsed);
  test.expect(afterSecondClick.collapsed).toBe(before.collapsed);
});
