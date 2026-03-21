import { featureTips } from '../feature-tips.js';
import { initGestureNavigation } from '../gesture-navigation.js';
import { applyBackgroundColor } from '../theme-utils.js';
import {
  SearchEngineManager, 
  updateSearchEngineIcon,
  setSearchEngineIcon,
  createSearchEngineDropdown, 
  initializeSearchEngineDialog,
  getSearchUrl,
  createTemporarySearchTabs,
  getSearchEngineIconPath
} from '../search-engine-dropdown.js';
import { getMainOpenInNewTab, getSearchOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';
import { STORAGE_KEYS } from '../../shared/storage-keys.js';
import { ICONS } from '../icons.js';
import { ColorCache, getColors, applyColors, updateBookmarkColors } from '../color-utils.js';
import { showQrCodeModal } from '../qrcode-modal.js';
import { openInNewWindow, openInIncognito, createUtilities } from '../bookmark-actions.js';
import { setVersionNumber, updateDefaultFoldersTabsVisibility, openSettingsModal, initScrollIndicator } from '../ui-helpers.js';
import { replaceIconsWithSvg, getIconHtml } from '../icons.js';
const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
const getLocalizedMessage = S.getLocalizedMessage;
const Utilities = createUtilities(getLocalizedMessage);
  let allSuggestions = [];
  let displayedSuggestions = 0;
  const suggestionsPerLoad = 10; // 每次加载10个建议

  let isScrollListenerAttached = false;

  function showSuggestions(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    allSuggestions = suggestions;
    displayedSuggestions = 0;
    searchSuggestions.innerHTML = '';
  
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.add('focused-with-suggestions');

    const suggestionsWrapper = document.querySelector('.search-suggestions-wrapper');
    if (suggestionsWrapper) {
      suggestionsWrapper.style.display = 'block';
    }
    searchSuggestions.style.display = 'block';

    // 显示 line-container
    const lineContainer = document.getElementById('line-container');
    lineContainer.style.display = 'block'; // 显示线条

    // Set a fixed height for the suggestions container
    searchSuggestions.style.maxHeight = '390px'; // Adjust this value as needed
    searchSuggestions.style.overflowY = 'auto';

    loadMoreSuggestions();

    if (!isScrollListenerAttached) {
      searchSuggestions.addEventListener('scroll', throttledHandleScroll);
      isScrollListenerAttached = true;
    }
    setTimeout(() => {
    }, 0);
  }

  function loadMoreSuggestions() {
    if (!Array.isArray(allSuggestions) || allSuggestions.length === 0) {
      return;
    }

    const remainingSuggestions = allSuggestions.length - displayedSuggestions;
    const suggestionsToAdd = Math.min(remainingSuggestions, 10);

    if (suggestionsToAdd <= 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = displayedSuggestions; i < displayedSuggestions + suggestionsToAdd; i++) {
      const li = createSuggestionElement(allSuggestions[i]);
      fragment.appendChild(li);
    }

    searchSuggestions.appendChild(fragment);
    displayedSuggestions += suggestionsToAdd;

  }

  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }

  const throttledHandleScroll = throttle(function() {
    const scrollPosition = searchSuggestions.scrollTop + searchSuggestions.clientHeight;
    const scrollHeight = searchSuggestions.scrollHeight;
    if (scrollPosition >= scrollHeight - 20 && displayedSuggestions < allSuggestions.length) {
      loadMoreSuggestions();
    }
  }, 200);  // 限制为每200毫秒最多执行一次

  function showNoMoreSuggestions() {
    const existingNoMore = searchSuggestions.querySelector('.no-more-suggestions');
    if (!existingNoMore) {
      const noMoreElement = document.createElement('li');
      noMoreElement.className = 'no-more-suggestions';
      noMoreElement.style.height = '38px'; // 设置一个固定高度，与他建议项保持一致
      noMoreElement.style.visibility = 'hidden'; // 使元素不可见，但保留空间
      searchSuggestions.appendChild(noMoreElement);
    }
  }

  // 修改创建建议元素的函数
  function createSuggestionElement(suggestion) {
    const li = document.createElement('li');
    const displayUrl = suggestion.url ? formatUrl(suggestion.url) : '';
    li.setAttribute('data-type', suggestion.type);
    if (suggestion.url) {
      li.setAttribute('data-url', suggestion.url);
    }
    const searchSvgIcon = `<svg class="suggestion-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
  <path d="M466.624 890.432a423.296 423.296 0 0 1-423.936-423.04C42.688 233.728 231.936 42.624 466.56 42.624a423.68 423.68 0 0 1 423.936 424.64 437.952 437.952 0 0 1-56.32 213.12 47.872 47.872 0 0 1-64.128 17.28 48 48 0 0 1-17.216-64.256c29.76-50.176 43.84-106.56 43.84-166.144-1.6-183.36-148.608-330.624-330.112-330.624a330.432 330.432 0 0 0-330.112 330.624 329.408 329.408 0 0 0 330.112 330.688c57.92 0 115.776-15.68 165.824-43.904a47.872 47.872 0 0 1 64.128 17.28 48 48 0 0 1-17.152 64.192 443.584 443.584 0 0 1-212.8 54.848z" fill="#334155"></path>
  <path d="M466.624 890.432a423.296 423.296 0 0 1-423.936-423.04c0-75.264 20.288-148.928 56.32-213.12a47.872 47.872 0 0 1 64.128-17.28 48 48 0 0 1 17.216 64.256 342.08 342.08 0 0 0-43.84 166.08c0 181.76 147.072 330.688 330.112 330.688a329.408 329.408 0 0 0 330.112-330.688A330.432 330.432 0 0 0 466.56 136.704c-57.856 0-115.776 15.68-165.824 43.84a47.872 47.872 0 0 1-64.128-17.216 48 48 0 0 1 17.216-64.256A436.032 436.032 0 0 1 466.56 42.688c233.088 0 422.4 189.568 422.4 424.64a422.016 422.016 0 0 1-422.4 423.104z" fill="#334155"></path>
  <path d="M934.4 981.312a44.992 44.992 0 0 1-32.832-14.08l-198.72-199.04c-18.752-18.816-18.752-48.576 0-65.792 18.752-18.816 48.512-18.816 65.728 0l198.656 199.04c18.816 18.752 18.816 48.576 0 65.792a47.68 47.68 0 0 1-32.832 14.08z" fill="#334155"></path>
</svg>`;
    // 限制建议文本的长度
    const maxTextLength = 20; // 你可以根据需要调整这个值
    const truncatedText = suggestion.text.length > maxTextLength 
      ? suggestion.text.substring(0, maxTextLength) + '...' 
      : suggestion.text;

    li.innerHTML = `
    ${suggestion.type === 'search' ? searchSvgIcon : '<span class="material-icons suggestion-icon"></span>'}
    <div class="suggestion-content">
      <span class="suggestion-text" title="${suggestion.text}">${truncatedText}</span>
      ${displayUrl ? `<span class="suggestion-dash">-</span><span class="suggestion-url">${displayUrl}</span>` : ''}
    </div>
    <span class="suggestion-type">${suggestion.type}</span>
  `;

    if (suggestion.url && suggestion.type !== 'search') {
      getFavicon(suggestion.url, (faviconUrl) => {
        const iconSpan = li.querySelector('.suggestion-icon');
        iconSpan.innerHTML = `<img src="${faviconUrl}" alt="" class="favicon">`;
      });
    }

    li.addEventListener('click', async () => {
      if (suggestion.url) {
        // 根据设置决定打开方式
        const openInNewTab = await getSearchOpenInNewTab();

        if (openInNewTab) {
          window.open(suggestion.url, '_blank');
        } else {
          window.location.href = suggestion.url;
        }
        
        await saveUserBehavior(suggestion.url);
      } else {
        searchInput.value = suggestion.text;
        searchInput.focus();
        queueSearch();
        await saveUserBehavior(suggestion.text);
      }
      hideSuggestions();
    });

    return li;
  }

  function formatUrl(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;

      // 移除 'www.' 前缀（如果存在）
      domain = domain.replace(/^www\./, '');

      // 如果路径不只是 '/'
      let path = urlObj.pathname;
      if (path && path !== '/') {
        // 截断长路径
        path = path.length > 10 ? path.substring(0, 10) + '...' : path;
        domain += path;
      }

      return domain;
    } catch (e) {
      // 如果 URL 解析失败，返回空字符串
      return '';
    }
  }


  // Add this function to fetch favicons
  function getFavicon(url, callback) {
    const faviconURL = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
    const img = new Image();
    img.onload = function () {
      callback(faviconURL);
    };
    img.onerror = function () {
      callback(''); // Return an empty string if favicon is not found
    };
    img.src = faviconURL;
  }

  // Add this function to fetch favicon online as a fallback
  function fetchFaviconOnline(url, callback) {
    const domain = new URL(url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const img = new Image();
    img.onload = function () {
      cacheFavicon(domain, faviconUrl);
      callback(faviconUrl);
    };
    img.onerror = function () {
      callback('');
    };
    img.src = faviconUrl;
  }

  // Add this function to cache favicons
  function cacheFavicon(domain, faviconUrl) {
    const data = {};
    data[domain] = faviconUrl;
    chrome.storage.local.set(data);
  }

  async function showDefaultSuggestions() {
    // 首先检查设置
    const settings = await new Promise(resolve => {
      chrome.storage.sync.get(
        ['showHistorySuggestions', 'showBookmarkSuggestions'],
        resolve
      );
    });

    let suggestions = [];

    // 只有在启用了历史记录建议时才获取历史记录
    if (settings.showHistorySuggestions !== false) {
      const recentHistory = await getRecentHistory(20);
      suggestions = suggestions.concat(recentHistory.map(item => ({
        text: item.text,
        url: item.url,
        type: 'history',
        relevance: item.relevance
      })));
    } else {
      // 如果历史记录已关闭且没有搜索词，不显示任何建议
      if (!searchInput.value.trim()) {
        hideSuggestions();
        return;
      }
    }

    // 如果启用了书签建议，可以在这里添加最近的书签
    if (settings.showBookmarkSuggestions !== false) {
      const recentBookmarks = await new Promise(resolve => {
        chrome.bookmarks.getRecent(10, resolve);
      });
      
      suggestions = suggestions.concat(recentBookmarks.map(item => ({
        text: item.title,
        url: item.url,
        type: 'bookmark',
        relevance: 1
      })));
    }

    // 如果没有任何建议，则不显示建议列表
    if (suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    showSuggestions(suggestions);
  }

  // 修改 handleInput 函数
  const handleInput = debounce(async () => {
    const query = searchInput.value.trim();
    showLoadingIndicator();
    
    if (query) {
      const suggestions = await getSuggestions(query);
      hideLoadingIndicator();
      // 移除 length > 1 的判断，因为我们总是想显示搜索建议
      showSuggestions(suggestions);
    } else {
      hideLoadingIndicator();
      showDefaultSuggestions();
    }
    updateSubmitButtonState();
  }, 300);

  // 同样修改 focus 事件监听器
  searchInput.addEventListener('focus', async () => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.add('focused');
    
    if (searchInput.value.trim() === '') {
      await showDefaultSuggestions();
    } else {
      const suggestions = await getSuggestions(searchInput.value.trim());
      // 移除 length > 1 的判断
      showSuggestions(suggestions);
    }
  });

  // 处理输入事件
  searchInput.addEventListener('input', () => {
    handleInput();
    updateSubmitButtonState();
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    }
  });

  // 处理键盘导航
  searchInput.addEventListener('keydown', (e) => {
    const items = searchSuggestions.querySelectorAll('li');
    let index = Array.from(items).findIndex(item => item.classList.contains('keyboard-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (index < items.length - 1) index++;
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) index--;
        break;
      case 'Enter':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          // 处理 Cmd/Ctrl + Enter
          const query = searchInput.value.trim();
          if (query) {
            openAllSearchEngines(query);
          }
        } else if (index !== -1) {
          e.stopPropagation(); // 阻止事件冒泡
          const selectedItem = items[index];
          const suggestionType = selectedItem.getAttribute('data-type');
          if (suggestionType === 'history' || suggestionType === 'bookmark') {
            const url = selectedItem.getAttribute('data-url');
            if (url) {
              window.open(url, '_blank');
              hideSuggestions();
              return;
            }
          }
          selectedItem.click();
        } else {
          performSearch(searchInput.value.trim());
        }
        return;
      default:
        return;
    }

    items.forEach(item => item.classList.remove('keyboard-selected'));
    if (index !== -1) {
      items[index].classList.add('keyboard-selected');
      // 只在选择搜索建议时更新输入框的值
      const selectedItem = items[index];
      const suggestionType = selectedItem.getAttribute('data-type');
      if (suggestionType === 'search') {
        searchInput.value = selectedItem.querySelector('.suggestion-text').textContent;
      }
    }
  })

  // 添加防抖函数
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }



  function hideSuggestions() {
    if (isChangingSearchEngine) {
      return; // 如果正在切换搜索引擎，不隐藏建议列表
    }
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused-with-suggestions');

    const suggestionsWrapper = document.querySelector('.search-suggestions-wrapper');
    if (suggestionsWrapper) {
      suggestionsWrapper.style.display = 'none';
    }
    if (searchSuggestions) {
      searchSuggestions.style.display = 'none';
      searchSuggestions.innerHTML = ''; // Clear the suggestions
    }

    // 隐藏 line-container
    const lineContainer = document.getElementById('line-container');
    lineContainer.style.display = 'none'; // 隐藏线条

    if (isScrollListenerAttached) {
      searchSuggestions.removeEventListener('scroll', throttledHandleScroll);
      isScrollListenerAttached = false;
    }

    // Reset suggestions-related variables
    allSuggestions = [];
    displayedSuggestions = 0;
  }

  function showLoadingIndicator() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
    <svg class="loading-spinner" viewBox="0 0 50 50">
      <circle class="spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
    </svg>
  `;
    searchSuggestions.appendChild(loadingIndicator);
  }

  function hideLoadingIndicator() {
    const loadingIndicator = searchSuggestions.querySelector('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }


  // 修改这个函数
  function openAllSearchEngines(query) {
    const enabledEngines = SearchEngineManager.getEnabledEngines();

    const urls = enabledEngines
      .map(engine => getSearchUrl(engine.name, query));

    if (urls.length > 0) {
      window.lastSearchTrigger = 'cmdCtrlEnter';

      chrome.runtime.sendMessage({
        action: 'openMultipleTabsAndGroup',
        urls: urls,
        groupName: query
      }, function (response) {
        if (!response || !response.success) {
          console.error('打开多个标签页或创建标签组失败:', response ? response.error : '未知错误');
        }
      });
    } else {
      console.log('没有启用的搜索引擎');
    }
  }
Object.assign(S, { showSuggestions, loadMoreSuggestions, throttle, createSuggestionElement, formatUrl, getFavicon, fetchFaviconOnline, cacheFavicon, showDefaultSuggestions, hideSuggestions, showLoadingIndicator, hideLoadingIndicator, openAllSearchEngines });
