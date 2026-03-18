import { createQuickLinksCache } from './modules/quick-links-cache.js';
import { getFixedShortcuts, getBlacklist, addToBlacklist } from './modules/quick-links-storage.js';
import { buildQuickLinks } from './modules/quick-links-data.js';
import { createQuickLinksUI } from './modules/quick-links-ui.js';

document.addEventListener('DOMContentLoaded', function () {
  const quickLinksCache = createQuickLinksCache();
  const quickLinksActions = {
    addToBlacklist,
    generateQuickLinks: null,
    updateFixedShortcut: null
  };
  const quickLinksUI = createQuickLinksUI(quickLinksActions);

  async function updateFixedShortcut(updatedSite, oldUrl) {
    chrome.storage.sync.get('fixedShortcuts', (result) => {
      let fixedShortcuts = result.fixedShortcuts || [];
      const index = fixedShortcuts.findIndex((shortcut) => shortcut.url === oldUrl);
      if (index !== -1) {
        fixedShortcuts[index] = updatedSite;
      } else {
        fixedShortcuts.push(updatedSite);
      }
      chrome.storage.sync.set({ fixedShortcuts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving updated shortcut:', chrome.runtime.lastError);
        } else {
          quickLinksUI.refreshQuickLink(updatedSite, oldUrl);
          setTimeout(() => generateQuickLinks(), 0);
        }
      });
    });
  }

  async function generateQuickLinks() {
    if (quickLinksCache.isValid()) {
      quickLinksUI.renderQuickLinks(quickLinksCache.data);
      updateQuickLinksCache();
      return;
    }

    const allShortcuts = await buildQuickLinks({
      getFixedShortcuts,
      getBlacklist,
      addToBlacklist
    });

    quickLinksUI.renderQuickLinks(allShortcuts);
  }

  async function updateQuickLinksCache() {
    const allShortcuts = await buildQuickLinks({
      getFixedShortcuts,
      getBlacklist,
      addToBlacklist
    });

    quickLinksCache.set(allShortcuts);
  }

  quickLinksActions.generateQuickLinks = generateQuickLinks;
  quickLinksActions.updateFixedShortcut = updateFixedShortcut;

  generateQuickLinks();
  quickLinksCache.load();
});
