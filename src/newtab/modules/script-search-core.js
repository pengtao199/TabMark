import { featureTips } from '../feature-tips.js';
import { initGestureNavigation } from '../gesture-navigation.js';
import { applyBackgroundColor } from '../theme-utils.js';
import {
  SearchEngineManager, 
  updateSearchEngineIcon,
  setSearchEngineIcon,
  createSearchEngineDropdown, 
  initializeSearchEngineDialog,
  createTemporarySearchTabs,
  getSearchEngineIconPath
} from '../search-engine-dropdown.js';
import { getMainOpenInNewTab, getSearchOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';
import { STORAGE_KEYS } from '../../shared/storage-keys.js';
import { ICONS } from '../icons.js';
import { ColorCache, getColors, applyColors, updateBookmarkColors } from '../color-utils.js';
import { showQrCodeModal } from '../qrcode-modal.js';
import { openInNewWindow, openInIncognito, createUtilities } from '../bookmark-actions.js';
import { showMovingFeedback, hideMovingFeedback, showSuccessFeedback, showErrorFeedback, setVersionNumber, updateDefaultFoldersTabsVisibility, openSettingsModal, initScrollIndicator } from '../ui-helpers.js';
import { replaceIconsWithSvg, getIconHtml } from '../icons.js';
const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
const getLocalizedMessage = S.getLocalizedMessage;
const Utilities = createUtilities(getLocalizedMessage);
  const tabsContainer = document.getElementById('tabs-container');
  const tabs = document.querySelectorAll('.tab');
  const defaultSearchEngine = localStorage.getItem('selectedSearchEngine') || 'Google';

  // 在文件的适当位置（可能在 DOMContentLoaded 事件监听器内）添加这个标志
  let isChangingSearchEngine = false;

  // 将 getSearchUrl 函数移到文件前面，在事件监听器之前定义
  function getSearchUrl(engine, query) {
    const allEngines = SearchEngineManager.getAllEngines();
    const engineConfig = allEngines.find(e => {
      // 匹配引擎名称或别名
      return e.name.toLowerCase() === engine.toLowerCase() || 
             (e.aliases && e.aliases.some(alias => alias.toLowerCase() === engine.toLowerCase()));
    });

    if (!engineConfig) {
      // 如果找不到对应的引擎配置,使用默认引擎
      const defaultEngine = SearchEngineManager.getDefaultEngine();
      return defaultEngine.url + encodeURIComponent(query);
    }

    // 确保 URL 中包含查询参数占位符
    const url = engineConfig.url.includes('%s') ? 
      engineConfig.url.replace('%s', encodeURIComponent(query)) :
      engineConfig.url + encodeURIComponent(query);

    return url;
  }



  tabs.forEach(tab => {
    tab.setAttribute('tabindex', '0');

    tab.addEventListener('click', function () {
        const selectedEngine = this.getAttribute('data-engine');
        const searchInput = document.querySelector('.search-input');
        const searchQuery = searchInput.value.trim();
        
        // 移除所有标签的激活状态
        tabs.forEach(t => t.classList.remove('active'));
        // 为当前点击的标签添加激活状态
        this.classList.add('active');

        // 如果搜索框有内容，立即执行搜索
        if (searchQuery) {
            const searchUrl = getSearchUrl(selectedEngine, searchQuery);
            window.open(searchUrl, '_blank');
            hideSuggestions();
            
            // 使用 setTimeout 延迟恢复默认搜索引擎状态
            setTimeout(restoreDefaultSearchEngine, 300);
        }
    });
  });

  new Sortable(tabsContainer, {
    animation: 150,
    onEnd: function (evt) {
      const orderedEngines = Array.from(tabsContainer.children).map(tab => tab.getAttribute('data-engine'));
      localStorage.setItem('orderedSearchEngines', JSON.stringify(orderedEngines));
    }
  });

  const savedOrder = JSON.parse(localStorage.getItem('orderedSearchEngines'));
  if (savedOrder) {
    savedOrder.forEach(engineName => {
      const tab = Array.from(tabs).find(tab => tab.getAttribute('data-engine') === engineName);
      if (tab) {
        tabsContainer.appendChild(tab);
      }
    });
  }

  const searchForm = document.getElementById('search-form');
  const searchInput = document.querySelector('.search-input');
  const searchEngineIcon = document.getElementById('search-engine-icon');

  searchInput.addEventListener('focus', function () {
    searchForm.classList.add('focused');
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    } else {
      const suggestions = getSuggestions(searchInput.value.trim());
      showSuggestions(suggestions);
    }
  });

  searchInput.addEventListener('blur', () => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused');
    // 使用 setTimeout 来延迟隐藏建议列表，允许点击建议
    setTimeout(() => {
      if (!searchForm.contains(document.activeElement)) {
        hideSuggestions();
      }
    }, 200);
  });

  if (!searchForm || !searchInput || !tabsContainer || !searchEngineIcon) {
    console.warn('[Search] Required search elements not found, skip search core init.');
  }

  updateSubmitButtonState();



  function updateSubmitButtonState() {
    if (searchInput.value.trim() === '') {
      tabsContainer.style.display = 'none';
    } else {
      // 只有当搜索建议列表不为空时才显示 tabs-container
      if (searchSuggestions.children.length > 0) {
        tabsContainer.style.display = 'flex';
      } else {
        tabsContainer.style.display = 'none';
      }
    }
  }

  let isSearching = false;
  let searchQueue = [];

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const debouncedPerformSearch = debounce(performSearch, 300);

  // Modify the search form submit event listener
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent default form submission
    performSearch(searchInput.value.trim());
  });

  function queueSearch() {
    const query = searchInput.value.trim();
    if (query === '') {
      return;
    }
    searchQueue.push(query);
    processSearchQueue();
  }

  function processSearchQueue() {
    if (isSearching || searchQueue.length === 0) {
      return;
    }
    
    const query = searchQueue.shift();
    debouncedPerformSearch(query);
  }
  // 修改 performSearch 函数
  function performSearch(query) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return;
    }

    isSearching = true;

    // 获取当前激活的搜索引擎用于本次搜索
    const activeTab = document.querySelector('.tab.active');
    const currentEngine = activeTab ? activeTab.getAttribute('data-engine') : defaultSearchEngine;
    console.log('[Search] Current engine for search:', currentEngine);

    // 获取真正的默认搜索引擎
    const defaultEngine = localStorage.getItem('selectedSearchEngine') || 'google';
    let url = getSearchUrl(currentEngine, query);

    // 在打开新窗口之前先恢复默认搜索引擎
    requestAnimationFrame(() => {
      // 1. 恢复 tabs-container 中的默认选中状态
      const tabs = document.querySelectorAll('.tab');
      console.log('[Search] Found tabs:', tabs.length);

      // 清除所有临时标记
      tabs.forEach(tab => {
        delete tab.dataset.temporary;
        if (tab.getAttribute('data-engine').toLowerCase() === defaultEngine.toLowerCase()) {
          console.log('[Search] Setting active tab:', defaultEngine);
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 根据设置决定打开方式
      getSearchOpenInNewTab().then((openInNewTab) => {
        console.log('[Search] Opening URL:', url, 'in new tab:', openInNewTab);
        
        if (openInNewTab) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
        
        hideSuggestions();
      });
    });

    setTimeout(() => {
      isSearching = false;
      processSearchQueue();
    }, 1000);
  }

  // 新增恢复默认搜索引擎的函数
  function restoreDefaultSearchEngine() {
    const defaultEngine = localStorage.getItem('selectedSearchEngine') || 'google';

    // 更新标签状态
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-engine') === defaultEngine) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 更新搜索引擎图标
    updateSearchEngineIcon(defaultEngine);
  }


  // 动态调整 textarea 度的函数
  function adjustTextareaHeight() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;

    searchInput.style.height = 'auto'; // 重置高度
    const lineHeight = parseInt(getComputedStyle(searchInput).lineHeight) || 21;
    const maxHeight = 3 * lineHeight; // 最多显示 3 行
    const newHeight = Math.min(searchInput.scrollHeight, maxHeight);
    searchInput.style.height = `${newHeight}px`;
  }

  // 在输入事件中调用调整高度的函数
  searchInput.addEventListener('input', adjustTextareaHeight);

  // 初始化时调整高度
  adjustTextareaHeight();

Object.assign(S, { getSearchUrl, updateSubmitButtonState, queueSearch, processSearchQueue, performSearch, restoreDefaultSearchEngine, adjustTextareaHeight });
