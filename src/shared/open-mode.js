import { STORAGE_KEYS } from './storage-keys.js';

function getSyncStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result || {}));
  });
}

export async function getMainOpenInNewTab() {
  const result = await getSyncStorage([STORAGE_KEYS.OPEN_IN_NEW_TAB]);
  return result[STORAGE_KEYS.OPEN_IN_NEW_TAB] !== false;
}

export async function getSidepanelOpenMode() {
  const result = await getSyncStorage([
    STORAGE_KEYS.SIDEPANEL_OPEN_IN_NEW_TAB,
    STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL
  ]);

  return {
    openInNewTab: result[STORAGE_KEYS.SIDEPANEL_OPEN_IN_NEW_TAB] !== false,
    openInSidepanel: result[STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL] === true
  };
}

export async function getSearchOpenInNewTab() {
  const result = await getSyncStorage([STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB]);
  return result[STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB] !== false;
}
