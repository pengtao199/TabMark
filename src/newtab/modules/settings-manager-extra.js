import { STORAGE_KEYS } from '../../shared/storage-keys.js';
import { SettingsManager } from './settings-manager-base.js';

  SettingsManager.prototype.initSearchSuggestionsSettings = function() {
    // 获取元素引用
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.openSearchInNewTabCheckbox = document.getElementById('open-search-in-new-tab');
    
    // 加载搜索建议设置
    chrome.storage.sync.get(
      ['showHistorySuggestions', 'showBookmarkSuggestions', 'showSearchBox', STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB], 
      (result) => {
        // 如果设置不存在(undefined)或者没有明确设置为 false,则默认为 true
        this.showHistorySuggestionsCheckbox.checked = result.showHistorySuggestions !== false;
        this.showBookmarkSuggestionsCheckbox.checked = result.showBookmarkSuggestions !== false;
        this.openSearchInNewTabCheckbox.checked = result[STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB] !== false;

        // 初始化时如果是新用户(设置不存在),则保存默认值
        if (!('showHistorySuggestions' in result)) {
          chrome.storage.sync.set({ showHistorySuggestions: true });
        }
        if (!('showBookmarkSuggestions' in result)) {
          chrome.storage.sync.set({ showBookmarkSuggestions: true });
        }
        if (!('showSearchBox' in result)) {
          chrome.storage.sync.set({ showSearchBox: false });
        }
        if (!(STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB in result)) {
          chrome.storage.sync.set({ [STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB]: true });
        }
      }
    );

    // 监听设置变化
    this.showHistorySuggestionsCheckbox.addEventListener('change', () => {
      const isEnabled = this.showHistorySuggestionsCheckbox.checked;
      chrome.storage.sync.set({ showHistorySuggestions: isEnabled });
    });

    this.showBookmarkSuggestionsCheckbox.addEventListener('change', () => {
      const isEnabled = this.showBookmarkSuggestionsCheckbox.checked;
      chrome.storage.sync.set({ showBookmarkSuggestions: isEnabled });
    });
    
    this.openSearchInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openSearchInNewTabCheckbox.checked;
      chrome.storage.sync.set({ [STORAGE_KEYS.OPEN_SEARCH_IN_NEW_TAB]: isEnabled });
    });
  }

  SettingsManager.prototype.initShortcutsSettings = function() {
    const shortcutItem = document.getElementById('configure-shortcuts');
    if (shortcutItem) {
      shortcutItem.addEventListener('click', () => {
        chrome.tabs.create({
          url: 'chrome://extensions/shortcuts'
        });
      });
    }
  }
