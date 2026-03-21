export { featureTips } from '../feature-tips.js';
export { initGestureNavigation } from '../gesture-navigation.js';
export { applyBackgroundColor } from '../theme-utils.js';
export {
  SearchEngineManager,
  updateSearchEngineIcon,
  setSearchEngineIcon,
  createSearchEngineDropdown,
  initializeSearchEngineDialog,
  getSearchUrl,
  createTemporarySearchTabs,
  getSearchEngineIconPath
} from '../search-engine-dropdown.js';
export { getMainOpenInNewTab, getSearchOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';
export { STORAGE_KEYS } from '../../shared/storage-keys.js';
export { ICONS, replaceIconsWithSvg, getIconHtml } from '../icons.js';
export { ColorCache, getColors, applyColors, updateBookmarkColors } from '../color-utils.js';
export { showQrCodeModal } from '../qrcode-modal.js';
export { openInNewWindow, openInIncognito, createUtilities } from '../bookmark-actions.js';
import { createUtilities } from '../bookmark-actions.js';
export {
  setVersionNumber,
  updateDefaultFoldersTabsVisibility,
  openSettingsModal,
  initScrollIndicator
} from '../ui-helpers.js';

const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
export const getLocalizedMessage = S.getLocalizedMessage;
export const Utilities = createUtilities(getLocalizedMessage);

const domReadyKeys = new Set();

export function onDomReadyOnce(key, callback) {
  if (domReadyKeys.has(key)) {
    return;
  }

  domReadyKeys.add(key);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
    return;
  }
  callback();
}
