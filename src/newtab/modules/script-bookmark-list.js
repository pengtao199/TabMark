import { getMainOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';
import { getColors, applyColors } from '../color-utils.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const folderPreviewCache = new Map();

function invalidateFolderPreviewCache(folderIds = []) {
  const ids = Array.isArray(folderIds) ? folderIds : [folderIds];
  ids.filter(Boolean).forEach((folderId) => {
    folderPreviewCache.delete(folderId);
  });
}

function resolveBookmarkIconSource(bookmarkId, bookmarkUrl) {
  if (typeof S.resolveBookmarkIconSource === 'function') {
    return S.resolveBookmarkIconSource(bookmarkId, bookmarkUrl);
  }

  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bookmarkUrl)}&size=32`;
}

function fetchFolderPreviewItems(folderId) {
  if (folderPreviewCache.has(folderId)) {
    return Promise.resolve(folderPreviewCache.get(folderId));
  }

  return new Promise((resolve) => {
    chrome.bookmarks.getChildren(folderId, (children) => {
      if (chrome.runtime.lastError) {
        folderPreviewCache.delete(folderId);
        resolve([]);
        return;
      }

      const previewItems = (children || [])
        .sort((a, b) => a.index - b.index)
        .slice(0, 9);

      folderPreviewCache.set(folderId, previewItems);
      resolve(previewItems);
    });
  });
}

function createFolderPreviewItem(item) {
  const previewItem = document.createElement('div');
  previewItem.className = 'bookmark-folder-preview-item';

  if (item.url) {
    const img = document.createElement('img');
    img.src = resolveBookmarkIconSource(item.id, item.url);
    img.alt = '';
    img.setAttribute('draggable', 'false');
    if (typeof S.hydrateBookmarkIconFromLocalCache === 'function') {
      Promise.resolve(S.hydrateBookmarkIconFromLocalCache(img, item.url)).catch((error) => {
        console.warn('Failed to hydrate folder preview icon from local cache:', item.url, error);
      });
    }
    previewItem.appendChild(img);
    return previewItem;
  }

  const icon = document.createElement('span');
  icon.className = 'material-icons bookmark-folder-preview-folder-icon';
  icon.textContent = 'folder';
  previewItem.appendChild(icon);
  return previewItem;
}

async function hydrateFolderPreview(visual, folder) {
  const previewItems = await fetchFolderPreviewItems(folder.id);
  if (!visual.isConnected) {
    return;
  }

  if (!previewItems.length) {
    visual.classList.add('is-empty-folder-preview');
    return;
  }

  visual.textContent = '';
  visual.classList.remove('is-empty-folder-preview');
  visual.classList.add('has-folder-preview');

  const grid = document.createElement('div');
  grid.className = 'bookmark-folder-preview-grid';

  previewItems.forEach((item) => {
    grid.appendChild(createFolderPreviewItem(item));
  });

  visual.appendChild(grid);
}

function createFolderCard(folder, index) {
  const runtimeCreateFolderCard = S.createFolderCard;
  if (typeof runtimeCreateFolderCard === 'function' && runtimeCreateFolderCard !== createFolderCard) {
    return runtimeCreateFolderCard(folder, index);
  }

  const card = document.createElement('div');
  card.className = 'bookmark-folder';
  card.dataset.id = folder.id;
  card.dataset.parentId = folder.parentId;
  card.dataset.index = index.toString();
  card.setAttribute('draggable', 'false');

  const visual = document.createElement('div');
  visual.className = 'bookmark-visual bookmark-folder-visual';

  const icon = document.createElement('span');
  icon.className = 'material-icons bookmark-folder-icon';
  icon.textContent = 'folder';
  visual.appendChild(icon);
  card.appendChild(visual);
  hydrateFolderPreview(visual, folder);

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = folder.title || '';
  card.appendChild(title);

  card.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!S.bookmarkFolderContextMenu && typeof S.createBookmarkFolderContextMenu === 'function') {
      S.bookmarkFolderContextMenu = S.createBookmarkFolderContextMenu();
    }

    if (!S.bookmarkFolderContextMenu) {
      console.warn('bookmark folder context menu is not available');
      return;
    }

    S.currentBookmarkFolder = card;

    if (typeof S.createMenuItems === 'function') {
      await S.createMenuItems(S.bookmarkFolderContextMenu);
    }

    const menu = S.bookmarkFolderContextMenu;
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';
    menu.style.left = '0';
    menu.style.top = '0';

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = event.clientX;
      let top = event.clientY;

      if (left + menuRect.width > viewportWidth) {
        left = Math.max(5, left - menuRect.width);
      }

      if (top + menuRect.height > viewportHeight) {
        top = Math.max(5, viewportHeight - menuRect.height - 5);
      }

      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = 'visible';
    });
  });

  card.addEventListener('click', () => {
    if (typeof S.updateBookmarksDisplay === 'function') {
      S.updateBookmarksDisplay(folder.id);
    }
    if (typeof S.updateFolderName === 'function') {
      S.updateFolderName(folder.id);
    }
  });

  return card;
}

function createBookmarkCreateCard() {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'bookmark-create-card';
  card.dataset.virtualCreate = 'true';
  card.setAttribute('aria-label', '新增书签或文件夹');
  card.setAttribute('draggable', 'false');

  const plus = document.createElement('span');
  plus.className = 'bookmark-create-icon';
  plus.textContent = '+';

  const visual = document.createElement('span');
  visual.className = 'bookmark-visual bookmark-create-visual';
  visual.appendChild(plus);

  const label = document.createElement('span');
  label.className = 'bookmark-create-label';
  label.textContent = '新增';

  card.appendChild(visual);
  card.appendChild(label);

  card.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof S.openCreateBookmarkPicker === 'function') {
      S.openCreateBookmarkPicker(card);
    }
  });

  return card;
}

function displayBookmarks(bookmark) {
  const bookmarksList = document.getElementById('bookmarks-list');
  const bookmarksContainer = document.querySelector('.bookmarks-container');
  if (!bookmarksList) {
    return;
  }

  const skipTransition = Boolean(S.skipBookmarkRenderTransition);
  if (!skipTransition) {
    bookmarksContainer.classList.remove('loaded');
  } else {
    bookmarksContainer.classList.add('loaded');
  }
  
  const fragment = document.createDocumentFragment();
  
  let itemsToDisplay = bookmark.children || [];
  const activeDraggedBookmarkId = S.activeDraggedBookmarkId || null;

  if (activeDraggedBookmarkId) {
    itemsToDisplay = itemsToDisplay.filter((child) => child.id !== activeDraggedBookmarkId);
  }
  
  itemsToDisplay.sort((a, b) => a.index - b.index);
  
  itemsToDisplay.forEach((child) => {
    if (child.url) {
      const card = createBookmarkCard(child, child.index);
      fragment.appendChild(card);
    } else {
      const folderCard = createFolderCard(child, child.index);
      fragment.appendChild(folderCard);
    }
  });

  fragment.appendChild(createBookmarkCreateCard());
  
  bookmarksList.innerHTML = '';
  bookmarksList.appendChild(fragment);
  bookmarksList.dataset.parentId = bookmark.id;
  
  if (!skipTransition) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bookmarksContainer.classList.add('loaded');
      });
    });
  } else {
    bookmarksContainer.classList.add('loaded');
  }
  
  if (typeof S.setupSortable === 'function') {
    S.setupSortable();
  }
}

// 修改创建书签卡片时的颜色处理
function createBookmarkCard(bookmark, index) {
  const card = document.createElement('a');
  card.href = bookmark.url;
  card.className = 'bookmark-card';
  card.dataset.id = bookmark.id;
  card.dataset.parentId = bookmark.parentId;
  card.dataset.index = index.toString();
  card.setAttribute('draggable', 'false');

  const img = document.createElement('img');
  img.className = 'w-6 h-6 mr-2';
  img.src = resolveBookmarkIconSource(bookmark.id, bookmark.url);
  img.setAttribute('draggable', 'false');
  if (typeof S.hydrateBookmarkIconFromLocalCache === 'function') {
    Promise.resolve(S.hydrateBookmarkIconFromLocalCache(img, bookmark.url)).catch((error) => {
      console.warn('Failed to hydrate bookmark icon from local cache:', bookmark.url, error);
    });
  }

  // 尝试从缓存获取颜色
  const cachedColors = localStorage.getItem(`bookmark-colors-${bookmark.id}`);
  
  if (cachedColors) {
    // 如果有缓存，直接应用缓存的颜色
    const colors = JSON.parse(cachedColors);
    applyColors(card, colors);
    
    // 只加载 favicon 图片，不重新计算颜色
    img.onload = null;
  } else {
    // 只在没有缓存时计算颜色
    img.onload = function() {
      const colors = getColors(img);
      applyColors(card, colors);
      localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(colors));
    };
  }

  img.onerror = function() {
    // 处 favicon 加载失败的情况
    const defaultColors = { primary: [200, 200, 200], secondary: [220, 220, 220] };
    applyColors(card, defaultColors);
    localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(defaultColors));
  };

  const visual = document.createElement('div');
  visual.className = 'bookmark-visual favicon';
  visual.appendChild(img);
  card.appendChild(visual);

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = bookmark.title;
  card.appendChild(title);

  const preventNativeDrag = (event) => {
    event.preventDefault();
  };

  card.addEventListener('dragstart', preventNativeDrag);
  img.addEventListener('dragstart', preventNativeDrag);
  title.addEventListener('dragstart', preventNativeDrag);

  card.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    event.stopPropagation(); // 阻止事件冒泡，防止触发文档级的contextmenu事件监听器
    console.log('Bookmark context menu triggered:', bookmark);
    if (typeof S.showContextMenu === 'function') {
      S.showContextMenu(event, bookmark, 'bookmark'); // 明确指定类型为 'bookmark'
    } else {
      console.warn('showContextMenu is not available');
    }
  });

  // 在文件顶部添加防重复点击控制
  let isProcessingClick = false;
  const CLICK_COOLDOWN = 500; // 点击冷却时间

  // 只使用一个事件处理器
  card.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if ((S.suppressBookmarkClicksUntil || 0) > Date.now()) {
      return;
    }

    if (isProcessingClick) return;
    isProcessingClick = true;

    try {
      // 通过页面文件名判断环境
      const isSidePanel = window.location.pathname.endsWith('sidepanel.html');
      const isInternalUrl = bookmark.url.startsWith('chrome://') || 
                           bookmark.url.startsWith('chrome-extension://') ||
                           bookmark.url.startsWith('edge://') ||
                           bookmark.url.startsWith('about:');

      console.log('[Bookmark Click] Starting...', {
        url: bookmark.url,
        isInternalUrl: isInternalUrl,
        isSidePanel: isSidePanel
      });

      // 处理内部链接
      if (isInternalUrl) {
        console.log('[Bookmark Click] Opening internal URL');
        chrome.tabs.create({
          url: bookmark.url,
          active: true
        }).then(tab => {
          console.log('[Bookmark Click] Internal tab created successfully:', tab);
        }).catch(error => {
          console.error('[Bookmark Click] Failed to create internal tab:', error);
        });
        return;
      }

      // 处理普通链接
      if (isSidePanel) {
        console.log('[Bookmark Click] Opening in Side Panel mode');
        const { openInNewTab, openInSidepanel } = await getSidepanelOpenMode();
          
        console.log('[Bookmark Click] Side Panel settings:', {
          openInNewTab: openInNewTab,
          openInSidepanel: openInSidepanel
        });
          
        if (openInSidepanel) {
            // 在侧边栏内打开链接
            console.log('[Bookmark Click] Opening in Side Panel iframe');
            // 使用 SidePanelManager 加载 URL
            try {
              // 检查 SidePanelManager 是否已定义
              if (typeof SidePanelManager === 'undefined') {
                // 如果未定义，则创建一个简单的加载函数
                console.log('[Bookmark Click] SidePanelManager not defined, using fallback method');
                const sidePanelContent = document.getElementById('side-panel-content');
                const sidePanelIframe = document.getElementById('side-panel-iframe');
                
                if (sidePanelContent && sidePanelIframe) {
                  sidePanelContent.style.display = 'block';
                  sidePanelIframe.src = bookmark.url;
                  
                  // 添加返回按钮
                  let backButton = document.querySelector('.back-to-links');
                  if (!backButton) {
                    backButton = document.createElement('div');
                    backButton.className = 'back-to-links';
                    backButton.innerHTML = '<span class="material-icons">arrow_back</span>';
                    document.body.appendChild(backButton);
                    
                    // 添加点击事件
                    backButton.addEventListener('click', () => {
                      sidePanelContent.style.display = 'none';
                      backButton.style.display = 'none';
                    });
                  }
                  
                  // 显示返回按钮
                  backButton.style.display = 'flex';
                } else {
                  console.error('[Bookmark Click] Side panel elements not found, falling back to new tab');
                  chrome.tabs.create({
                    url: bookmark.url,
                    active: true
                  });
                }
              } else if (window.sidePanelManager) {
                window.sidePanelManager.loadUrl(bookmark.url);
              } else {
                // 如果 SidePanelManager 已定义但实例不存在，创建一个新实例
                window.sidePanelManager = new SidePanelManager();
                window.sidePanelManager.loadUrl(bookmark.url);
              }
            } catch (error) {
              console.error('[Bookmark Click] Error using SidePanelManager:', error);
              // 出错时回退到在新标签页中打开
              chrome.tabs.create({
                url: bookmark.url,
                active: true
              });
            }
        } else if (openInNewTab) {
            // 在新标签页中打开
            chrome.tabs.create({
              url: bookmark.url,
              active: true
            }).then(tab => {
              console.log('[Bookmark Click] Tab created successfully:', tab);
            }).catch(error => {
              console.error('[Bookmark Click] Failed to create tab:', error);
            });
        }
      } else {
        console.log('[Bookmark Click] Opening in Main Window mode');
        const openInNewTab = await getMainOpenInNewTab();
        if (openInNewTab) {
          window.open(bookmark.url, '_blank');
        } else {
          window.location.href = bookmark.url;
        }
      }
    } catch (error) {
      console.error('[Bookmark Click] Error:', error);
    } finally {
      setTimeout(() => {
        isProcessingClick = false;
      }, CLICK_COOLDOWN);
    }
  });

  return card;
}


assignToScriptState({
  displayBookmarks,
  createBookmarkCard,
  createFolderCard,
  invalidateFolderPreviewCache
});
