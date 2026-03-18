import { setSearchEngineIcon } from '../search-engine-dropdown.js';
import { STORAGE_KEYS } from '../../shared/storage-keys.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
function updateBookmarkCards() {
  const bookmarksList = document.getElementById('bookmarks-list');
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  const parentId = defaultBookmarkId || bookmarksList.dataset.parentId || '1';

  chrome.bookmarks.getChildren(parentId, function (bookmarks) {
    S.displayBookmarks({ id: parentId, children: bookmarks });

    // 在显示书签后更新默认书签指示器
    if (typeof S.updateDefaultBookmarkIndicator === 'function') {
      S.updateDefaultBookmarkIndicator();
    }
    if (typeof S.updateSidebarDefaultBookmarkIndicator === 'function') {
      S.updateSidebarDefaultBookmarkIndicator();
    }

    // 更新 bookmarks-list 的 data-parent-id
    bookmarksList.dataset.parentId = parentId;
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Create context menu immediately when the document loads
  S.contextMenu = S.createContextMenu ? S.createContextMenu() : null;
  
  const searchEngineIcon = document.getElementById('search-engine-icon');
  const defaultSearchEngine = localStorage.getItem('selectedSearchEngine') || 'google';
  console.log('[Init] Default search engine:', localStorage.getItem('selectedSearchEngine'));
  let deletedBookmark = null;
  let deletedCategory = null; // 添加这行
  let deleteTimeout = null;
  let bookmarkTreeNodes = []; // 定义全局变量
  // 调用 updateBookmarkCards
  updateBookmarkCards();
  
  updateSearchEngineIcon(defaultSearchEngine);

  if (searchEngineIcon.src === '') {      
    searchEngineIcon.src = '../images/placeholder-icon.svg';
  }
  setTimeout(() => {
    updateSearchEngineIcon(defaultSearchEngine);
  }, 0);

  // 修改 updateSearchEngineIcon 函数
  function updateSearchEngineIcon(engineName) {
    setSearchEngineIcon(engineName);
  }

  // 更新侧边栏默认书签指示器和选中状态
  if (typeof S.updateSidebarDefaultBookmarkIndicator === 'function') {
    S.updateSidebarDefaultBookmarkIndicator();
  }

  // ... 其他代码 ...

  


  
  // 优化后的更新显示函数
  async function updateBookmarksDisplay(parentId, movedItemId = null) {
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    
    // 添加加载状态
    bookmarksContainer.classList.add('loading');
    
    try {
      const cached = S.bookmarksCache?.get ? S.bookmarksCache.get(parentId) : null;
      
      if (cached && !movedItemId) {
        // 使用缓存数据进行分页显示
        renderBookmarksPage(cached, 0);
        return;
      }

      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          throw chrome.runtime.lastError;
        }
        
        // 缓存新数据
        if (S.bookmarksCache?.set) {
          S.bookmarksCache.set(parentId, bookmarks);
        }
        
        // 初始渲染第一页
        renderBookmarksPage({ bookmarks, totalCount: bookmarks.length }, 0);
      });
    } finally {
      // 移除加载状态
      bookmarksContainer.classList.remove('loading');
    }
  }

  // 分页渲染函数
  function renderBookmarksPage(cachedData, pageIndex, pageSize = 100) {
    const startIndex = pageIndex * pageSize;
    const endIndex = Math.min(startIndex + pageSize, cachedData.totalCount);
    
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    
    // 使用 DocumentFragment 优化 DOM 操作
    const fragment = document.createDocumentFragment();
    
    // 获取当前页的书签
    const pageBookmarks = cachedData.bookmarks.slice(startIndex, endIndex);
    
    // 渲染书签
    pageBookmarks.forEach((bookmark, index) => {
      const bookmarkElement = bookmark.url
        ? (typeof S.createBookmarkCard === 'function' ? S.createBookmarkCard(bookmark, startIndex + index) : null)
        : (typeof S.createFolderCard === 'function' ? S.createFolderCard(bookmark, startIndex + index) : null);
      if (!bookmarkElement) {
        return;
      }
      fragment.appendChild(bookmarkElement);
    });
    
    // 更新 DOM
    bookmarksList.innerHTML = '';
    bookmarksList.appendChild(fragment);
    
    // 更新分页信息
    updatePagination(pageIndex, Math.ceil(cachedData.totalCount / pageSize));
  }

  // 添加分页控制
  function updatePagination(currentPage, totalPages) {
    // 实现分页控制UI
    // ...
  }

  // 化书顺序步
  function syncBookmarkOrder(parentId) {
    const cached = S.bookmarksCache?.get ? S.bookmarksCache.get(parentId) : null;
    if (!cached) return;
    
    chrome.bookmarks.getChildren(parentId, (bookmarks) => {
      const chromeOrder = bookmarks.map(b => b.id);
      const cachedOrder = cached.bookmarks.map(b => b.id);
      
      if (JSON.stringify(chromeOrder) !== JSON.stringify(cachedOrder)) {
        // 更新缓存
        if (S.bookmarksCache?.set) {
          S.bookmarksCache.set(parentId, bookmarks);
        }
        
        // 重新渲染当前页
        renderBookmarksPage({ bookmarks, totalCount: bookmarks.length }, 0);
      }
    });
  }

  // 修改右键菜单事件监听器
  document.addEventListener('contextmenu', async function (event) {
    const targetFolder = event.target.closest('.bookmark-folder');
    
    if (targetFolder) {
      event.preventDefault();
      event.stopPropagation(); // 阻止事件冒泡
      
      // 确保文件夹上下文菜单存在
      if (!S.bookmarkFolderContextMenu) {
        S.bookmarkFolderContextMenu = S.createBookmarkFolderContextMenu();
      }

      if (!S.bookmarkFolderContextMenu) {
        console.error('Failed to create bookmark folder context menu');
        return;
      }

      // 更新当前文件夹
      const oldFolder = S.currentBookmarkFolder;
      S.currentBookmarkFolder = targetFolder;
      
      // 重新创建菜单项
      await S.createMenuItems(S.bookmarkFolderContextMenu);
      
      // 先显示菜单但设为不可见，以便获取其尺寸
      S.bookmarkFolderContextMenu.style.display = 'block';
      S.bookmarkFolderContextMenu.style.visibility = 'hidden';
      S.bookmarkFolderContextMenu.style.left = '0';
      S.bookmarkFolderContextMenu.style.top = '0';
      
      // 获取视窗尺寸
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // 等待一下以确保菜单已渲染
      setTimeout(() => {
        const menuRect = S.bookmarkFolderContextMenu.getBoundingClientRect();
        
        // 计算最佳位置
        let left = event.clientX;
        let top = event.clientY;
        
        // 检查右侧空间
        if (left + menuRect.width > viewportWidth) {
          // 如果右侧空间不足，尝试将菜单放在点击位置的左侧
          left = Math.max(5, left - menuRect.width);
        }
        
        // 检查底部空间
        if (top + menuRect.height > viewportHeight) {
          // 如果底部空间不足，尝试将菜单放在点击位置的上方
          top = Math.max(5, viewportHeight - menuRect.height - 5);
        }
        
        // 应用计算后的位置
        S.bookmarkFolderContextMenu.style.left = `${left}px`;
        S.bookmarkFolderContextMenu.style.top = `${top}px`;
        
        // 使菜单可见
        S.bookmarkFolderContextMenu.style.visibility = 'visible';
      }, 0);

      // 隐藏其他上下文菜单
      if (S.contextMenu) {
        S.contextMenu.style.display = 'none';
      }
    }
  });

  // 修改文档点击事件，确保正确关闭菜单
  document.addEventListener('click', function(event) {
    // 如果点击的不是菜单本身，则关闭菜单
    if (S.bookmarkFolderContextMenu && 
        !S.bookmarkFolderContextMenu.contains(event.target) && 
        !event.target.closest('.bookmark-folder')) {
      S.bookmarkFolderContextMenu.style.display = 'none';
      S.currentBookmarkFolder = null; // 重置当前文件夹
    }
  });

  // 为菜单本身添加点击事件处理
  if (S.bookmarkFolderContextMenu) {
    S.bookmarkFolderContextMenu.addEventListener('click', function(event) {
      event.stopPropagation(); // 阻止事件冒泡到文档
    });
  }

  // 在点击其他地方时重置状态
  document.addEventListener('click', function () {
    // 延迟处理点击事件，让菜单项的点击事件先执行
    setTimeout(() => {
    if (S.contextMenu) {
      S.contextMenu.style.display = 'none';
        S.currentBookmark = null;
      }
      
      if (S.bookmarkFolderContextMenu) {
        S.bookmarkFolderContextMenu.style.display = 'none';
        S.currentBookmarkFolder = null;
      }
    }, 200);
  });
});

// 移除所有 defaultBookmarkId 相关的代码
// 修改 waitForFirstCategory 函数
async function waitForFirstCategory(attemptsLeft = 5) {
  try {
    // 1. 先隐藏书签列表，避免闪烁
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    if (bookmarksList && bookmarksContainer) {
      bookmarksContainer.style.opacity = '0';
      bookmarksContainer.style.transition = 'opacity 0.3s ease';
    }

    // 2. 尝试获取上次访问的文件夹
    const { [STORAGE_KEYS.LAST_VIEWED_FOLDER]: lastViewedFolder } = await chrome.storage.local.get(STORAGE_KEYS.LAST_VIEWED_FOLDER);
    
    if (lastViewedFolder) {
      try {
        const results = await chrome.bookmarks.get(lastViewedFolder);
        if (results && results.length > 0) {
          if (typeof S.updateBookmarksDisplay === 'function') {
            await S.updateBookmarksDisplay(lastViewedFolder);
          } else {
            updateBookmarkCards();
          }
          S.updateFolderName(lastViewedFolder);
          S.selectSidebarFolder(lastViewedFolder);
          // 显示内容
          bookmarksContainer.style.opacity = '1';
          return;
        }
      } catch (error) {
        console.log('Last viewed folder no longer exists:', error);
      }
    }

    // 3. 尝试使用用户设置的默认文件夹
    const { [STORAGE_KEYS.DEFAULT_FOLDERS]: defaultFolders } = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_FOLDERS);
    if (defaultFolders?.items?.length > 0) {
      const defaultFolderId = defaultFolders.items[0].id;
      try {
        const results = await chrome.bookmarks.get(defaultFolderId);
        if (results && results.length > 0) {
          if (typeof S.updateBookmarksDisplay === 'function') {
            await S.updateBookmarksDisplay(defaultFolderId);
          } else {
            updateBookmarkCards();
          }
          S.updateFolderName(defaultFolderId);
          S.selectSidebarFolder(defaultFolderId);
          // 显示内容
          bookmarksContainer.style.opacity = '1';
          return;
        }
      } catch (error) {
        console.log('Default folder no longer exists:', error);
      }
    }

    // 4. 兜底方案：使用书签栏根目录
    if (typeof S.updateBookmarksDisplay === 'function') {
      await S.updateBookmarksDisplay('1');
    } else {
      updateBookmarkCards();
    }
    S.updateFolderName('1');
    S.selectSidebarFolder('1');
    // 显示内容
    bookmarksContainer.style.opacity = '1';

  } catch (error) {
    console.error('Error in waitForFirstCategory:', error);
    if (attemptsLeft > 0) {
      setTimeout(() => waitForFirstCategory(attemptsLeft - 1), 1000);
    } else {
      // 重试次数用完，使用根目录
      if (typeof S.updateBookmarksDisplay === 'function') {
        await S.updateBookmarksDisplay('1');
      } else {
        updateBookmarkCards();
      }
      S.updateFolderName('1');
      S.selectSidebarFolder('1');
      // 显示内容
      const bookmarksContainer = document.querySelector('.bookmarks-container');
      if (bookmarksContainer) {
        bookmarksContainer.style.opacity = '1';
      }
    }
  }
}

// 修改 initDefaultFoldersTabs 函数
assignToScriptState({ updateBookmarkCards, waitForFirstCategory });
