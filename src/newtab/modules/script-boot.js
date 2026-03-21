import {
  createSearchEngineDropdown,
  createTemporarySearchTabs,
  setVersionNumber,
  updateDefaultFoldersTabsVisibility,
  initScrollIndicator,
  onDomReadyOnce
} from './script-shared-init.js';
import { getScriptState } from './script-runtime-bridge.js';

const S = getScriptState();

onDomReadyOnce('script-boot:startup', function() {
  createSearchEngineDropdown();
  if (typeof S.initDefaultFoldersTabs === 'function') {
    S.initDefaultFoldersTabs();
  }
  setTimeout(setVersionNumber, 100);

  const searchEngineIcon = document.getElementById('search-engine-icon');
  if (searchEngineIcon && searchEngineIcon.src === '') {
    searchEngineIcon.src = '../images/placeholder-icon.svg';
  }

  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    const observer = new MutationObserver(updateDefaultFoldersTabsVisibility);
    observer.observe(sidebarContainer, { attributes: true, attributeFilter: ['class'] });
  }

  updateDefaultFoldersTabsVisibility();

  if (typeof S.initVirtualScroll === 'function') {
    S.initVirtualScroll();
  }
  initScrollIndicator();
  if (typeof S.startPeriodicSync === 'function') {
    S.startPeriodicSync();
  }
});

// 修改文档点击监听器，同时处理书签和文件夹的上下文菜单
document.addEventListener('click', function (event) {
  // 关闭书签上下文菜单
  if (S.contextMenu) {
    S.contextMenu.style.display = 'none';
    S.currentBookmark = null;
  }

  // 关闭文件夹上下文菜单
  if (S.bookmarkFolderContextMenu) {
    S.bookmarkFolderContextMenu.style.display = 'none';
    S.currentBookmarkFolder = null;
  }
});

// 为上下文菜单添加阻止冒泡，防止点击菜单本身时关闭
if (S.contextMenu) {
  S.contextMenu.addEventListener('click', function(event) {
    event.stopPropagation();
  });
}

if (S.bookmarkFolderContextMenu) {
  S.bookmarkFolderContextMenu.addEventListener('click', function(event) {
    event.stopPropagation();
  });
}

// 添加一个全局函数用于更新快捷链接显示状态
function updateQuickLinksVisibility() {
  chrome.storage.sync.get(['enableQuickLinks'], function(result) {
    const quickLinksWrapper = document.querySelector('.quick-links-wrapper');
    if (quickLinksWrapper) {
      quickLinksWrapper.style.display = result.enableQuickLinks !== false ? 'flex' : 'none';
    }
  });
}

// 监听存储变化
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.enableQuickLinks) {
    updateQuickLinksVisibility();
  }
});

// 添加搜索引擎变更事件监听
document.addEventListener('defaultSearchEngineChanged', (event) => {
  console.log('[Search] Default engine changed:', event.detail.engine);
  // 可以在这里添加其他需要响应搜索引擎变更的逻辑
  createTemporarySearchTabs(); // 添加这行以更新临时搜索标签
});
// 监听默认文件夹变化
document.addEventListener('defaultFoldersChanged', async () => {
  if (typeof S.initDefaultFoldersTabs === 'function') {
    await S.initDefaultFoldersTabs();
  }
  updateDefaultFoldersTabsVisibility();
});
