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


// 新增辅助函数


async function toggleDefaultFolder(folder) {
  if (!folder?.dataset?.id) {
    console.error('Invalid folder object:', folder);
    return;
  }

  const folderId = folder.dataset.id;
  // 根据不同的文件夹元素结构获取文件夹名称
  let folderName;
  if (folder.classList.contains('bookmark-folder')) {
      // 主内容区的文件夹卡片
      folderName = folder.querySelector('.card-title')?.textContent;
  } else {
      // 侧边栏的文件夹
      folderName = folder.dataset.title || folder.textContent.trim();
  }

  console.log('Toggle default folder:', {
      folderId,
      folderName,
      element: folder
  });

  if (!folderName) {
      console.error('Could not find folder name');
      return;
  }

  try {
      const data = await chrome.storage.sync.get('defaultFolders');
      let defaultFolders = data.defaultFolders?.items || [];
      const isDefault = defaultFolders.some(f => f.id === folderId);

      if (isDefault) {
          defaultFolders = defaultFolders.filter(f => f.id !== folderId);
          defaultFolders = defaultFolders.map((f, index) => ({
              ...f,
              order: index
          }));
          showToast(chrome.i18n.getMessage("removedFromDefaultFolders", [folderName]));
      } else {
          if (defaultFolders.length >= 8) {
              showToast(chrome.i18n.getMessage("maxDefaultFoldersReached"));
              return;
          }
          defaultFolders.push({
              id: folderId,
              name: folderName,
              order: defaultFolders.length
          });
          showToast(chrome.i18n.getMessage("addedToDefaultFolders", [folderName]));
      }

      await chrome.storage.sync.set({
          defaultFolders: {
              items: defaultFolders,
              lastUpdated: Date.now()
          }
      });

      // 立即更新UI
      if (typeof S.initDefaultFoldersTabs === 'function') {
        await S.initDefaultFoldersTabs();
      }

      // 如果是新添加的默认文件夹，自动切换到该文件夹
      if (!isDefault) {
          if (typeof S.switchToFolder === 'function') {
            await S.switchToFolder(folderId);
          }
      }

      // 触发更新事件
      document.dispatchEvent(new CustomEvent('defaultFoldersChanged', {
          detail: { folders: defaultFolders }
      }));

  } catch (error) {
      console.error('Error toggling default folder:', error);
      showToast('操作失败，请重试');
  }
}





// 监听默认文件夹变化
document.addEventListener('defaultFoldersChanged', async () => {
  if (typeof S.initDefaultFoldersTabs === 'function') {
    await S.initDefaultFoldersTabs();
  }
  updateDefaultFoldersTabsVisibility();
});
