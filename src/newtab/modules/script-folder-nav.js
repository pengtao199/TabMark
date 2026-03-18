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
import { showMovingFeedback, hideMovingFeedback, showSuccessFeedback, showErrorFeedback, setVersionNumber, updateDefaultFoldersTabsVisibility, openSettingsModal, initScrollIndicator } from '../ui-helpers.js';
import { replaceIconsWithSvg, getIconHtml } from '../icons.js';
const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
const getLocalizedMessage = S.getLocalizedMessage;
const Utilities = createUtilities(getLocalizedMessage);
async function initDefaultFoldersTabs() {
  const tabsContainer = document.querySelector('.tabs-container');
  const defaultFoldersTabs = document.querySelector('.default-folders-tabs');
  
  if (!tabsContainer || !defaultFoldersTabs) {
    console.error('Tabs container not found');
    return;
  }

  // 获取默认文件夹列表
  const data = await chrome.storage.sync.get([STORAGE_KEYS.DEFAULT_FOLDERS, STORAGE_KEYS.LAST_VIEWED_FOLDER]);
  let defaultFolders = data[STORAGE_KEYS.DEFAULT_FOLDERS]?.items || [];
  const lastViewedFolder = data[STORAGE_KEYS.LAST_VIEWED_FOLDER];
  
  // 确保文件夹按 order 排序
  defaultFolders = defaultFolders.sort((a, b) => a.order - b.order);
  
  console.log('Initializing default folders tabs:', defaultFolders);

  // 清空现有标签
  tabsContainer.innerHTML = '';

  // 创建标签
  for (const folder of defaultFolders) {
    const tab = document.createElement('div');
    tab.className = 'folder-tab';
    tab.dataset.folderId = folder.id;
    tab.dataset.order = folder.order;
    tab.dataset.name = folder.name;
    tab.addEventListener('click', () => switchToFolder(folder.id));
    tabsContainer.appendChild(tab);
  }

  // 只调用一次更新书签树
  chrome.bookmarks.getTree(function (nodes) {
    bookmarkTreeNodes = nodes;
    displayBookmarkCategories(bookmarkTreeNodes[0].children, 0, null, '1');
  });

  // 如果有默认文件夹，激活第一个或上次访问的文件夹
  if (defaultFolders.length > 0) {
    let folderToActivate;
    
    // 检查上次访问的文件夹是否在默认文件夹列表中
    if (lastViewedFolder && defaultFolders.some(f => f.id === lastViewedFolder)) {
      folderToActivate = lastViewedFolder;
    } else {
      // 否则使用第一个默认文件夹
      folderToActivate = defaultFolders[0].id;
    }

    // 激活选中的文件夹
    const activeTab = document.querySelector(`.folder-tab[data-folder-id="${folderToActivate}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.transform = 'scale(1.2)';
    }

    // 切换到选中的文件夹
    await switchToFolder(folderToActivate);
  } else {
    // 当没有默认文件夹时，切换到根文件夹或其他指定文件夹
    await switchToFolder('1'); // '1' 是根文件夹的 ID
  }

  // 重新初始化滚轮切换功能
  initWheelSwitching();

  // 更新显示状态
  updateDefaultFoldersTabsVisibility();

  return defaultFolders;
}

// 修改滚轮切换功能的实现
function initWheelSwitching() {
  const main = document.querySelector('main');
  if (!main) return;

  let wheelTimeout;
  let isProcessing = false;
  let wheelEventListener = null;
  let isEnabled = false; // 默认禁用
  
  // 创建滚轮事件处理函数
  const wheelHandler = async (event) => {
    // 如果功能被禁用，直接返回
    if (!isEnabled) return;
    
    // 检查是否在搜索相关元素内滚动
    if (event.target.closest('#bookmarks-list') || 
        event.target.closest('.search-form') || 
        event.target.closest('.search-suggestions') ||
        event.target.closest('.search-suggestions-wrapper')) {
      return;
    }

    // 防止重复触发
    if (isProcessing) return;

    // 防抖处理
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(async () => {
      isProcessing = true;

      try {
        const data = await chrome.storage.sync.get('defaultFolders');
        const defaultFolders = data.defaultFolders?.items || [];
        if (defaultFolders.length <= 1) {
          isProcessing = false;
          return;
        }

        // 获取当前激活的标签
        const activeTab = document.querySelector('.folder-tab.active');
        if (!activeTab) {
          isProcessing = false;
          return;
        }

        const currentOrder = parseInt(activeTab.dataset.order);
        let nextOrder;

        // 根据滚动方向决定下一个标签
        if (event.deltaY > 0) { // 向下滚动
          nextOrder = currentOrder + 1;
          if (nextOrder >= defaultFolders.length) {
            nextOrder = 0;
          }
        } else { // 向上滚动
          nextOrder = currentOrder - 1;
          if (nextOrder < 0) {
            nextOrder = defaultFolders.length - 1;
          }
        }

        // 找到对应顺序的文件夹并切换
        const nextFolder = defaultFolders.find(f => f.order === nextOrder);
        if (nextFolder) {
          await switchToFolder(nextFolder.id);
          
          // 添加切换动画效果
          const tabs = document.querySelectorAll('.folder-tab');
          tabs.forEach(tab => {
            if (tab.dataset.folderId === nextFolder.id) {
              tab.classList.add('switching');
              tab.style.transform = 'scale(1.2)';
              setTimeout(() => {
                tab.classList.remove('switching');
              }, 1500);
            } else {
              tab.style.transform = 'scale(1)';
            }
          });
        }
      } catch (error) {
        console.error('Error in wheel switching:', error);
      } finally {
        // 设置一个短暂的冷却时间
        setTimeout(() => {
          isProcessing = false;
        }, 150);
      }
    }, 50); // 50ms 的防抖延迟
  };
  
  // 添加或移除事件监听器的函数
  const updateWheelListener = (enabled) => {
    if (enabled) {
      if (!wheelEventListener) {
        main.addEventListener('wheel', wheelHandler, { passive: true });
        wheelEventListener = wheelHandler;
      }
    } else {
      if (wheelEventListener) {
        main.removeEventListener('wheel', wheelEventListener);
        wheelEventListener = null;
      }
    }
  };
  
  // 检查设置并初始化
  chrome.storage.sync.get({ enableWheelSwitching: false }, (result) => {
    isEnabled = result.enableWheelSwitching;
    updateWheelListener(isEnabled);
  });
  
  // 监听设置变化
  document.addEventListener('wheelSwitchingChanged', (event) => {
    isEnabled = event.detail.enabled;
    updateWheelListener(isEnabled);
  });
}

// 修改文件夹切换函数，确保同步更新所有状态
async function switchToFolder(folderId) {
  try {
    console.log('Switching to folder:', folderId);
    
    // 验证文件夹是否存在
    const results = await chrome.bookmarks.get(folderId);
    if (!results || results.length === 0) {
      throw new Error('Folder not found');
    }

    // 更新UI状态
    document.querySelectorAll('.folder-tab').forEach(tab => {
      const isActive = tab.dataset.folderId === folderId;
      tab.classList.toggle('active', isActive);
      tab.style.transform = isActive ? 'scale(1.2)' : 'scale(1)';
      tab.style.transition = 'transform 0.3s ease';
    });

    // 同步更新所有状态
    await Promise.all([
      updateBookmarksDisplay(folderId),
      updateFolderName(folderId),
      selectSidebarFolder(folderId)
    ]);

    // 保存最后访问的文件夹
    await chrome.storage.local.set({ 
      lastViewedFolder: folderId,
      lastViewedTime: Date.now()
    });
    
  } catch (error) {
    console.error('Error switching folder:', error);
    // 错误时回退到根目录
    await updateBookmarksDisplay('1');
    updateFolderName('1');
    selectSidebarFolder('1');
  }
}

function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
  return new Promise((resolve, reject) => {
    // 首先检查缓存
    const cached = bookmarksCache.get(parentId);
    if (cached && !movedItemId) {
      // 如果有缓存且不是移动操作，直接使用缓存数据
      console.log('Using cached bookmarks for:', parentId);
      displayBookmarks({ id: parentId, children: cached.bookmarks });
      resolve();
      return;
    }

    // 如果没有缓存或是移动操作，从 Chrome API 获取数据
    chrome.bookmarks.getChildren(parentId, (bookmarks) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const bookmarksList = document.getElementById('bookmarks-list');
      const bookmarksContainer = document.querySelector('.bookmarks-container');

      // 更新缓存
      bookmarksCache.set(parentId, bookmarks);

      // 显示书签
      displayBookmarks({ id: parentId, children: bookmarks });

      if (movedItemId) {
        highlightBookmark(movedItemId);
      }

      // 更新文件夹名称
      updateFolderName(parentId);

      resolve();
    });
  });
}

// 获取书栏的本地化名称
function getBookmarksBarName() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree(function(tree) {
      if (tree && tree[0] && tree[0].children) {
        const bookmarksBar = tree[0].children.find(child => child.id === '1');
        if (bookmarksBar) {
          resolve(bookmarksBar.title);
        } else {
          resolve('Bookmarks Bar'); // 默认英文名称
        }
      } else {
        resolve('Bookmarks Bar'); // 默认英文名称
      }
    });
  });
}

function getBookmarkPath(bookmarkId) {
  return new Promise((resolve, reject) => {
    getBookmarksBarName().then(bookmarksBarName => {
      function getParentRecursive(id, path = []) {
        chrome.bookmarks.get(id, function(results) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (results && results[0]) {
            path.unshift(results[0].title);
            if (results[0].parentId && results[0].parentId !== '0') {
              getParentRecursive(results[0].parentId, path);
            } else {
              // 确保书签栏名称总是作为第一个元素
              if (path[0] !== bookmarksBarName) {
                path.unshift(bookmarksBarName);
              }
              resolve(path);
            }
          } else {
            reject(new Error('Bookmark not found'));
          }
        });
      }
      getParentRecursive(bookmarkId);
    });
  });
}

function updateFolderName(bookmarkId) {
  const folderNameElement = document.getElementById('folder-name');
  if (!folderNameElement) return;

  // 清除所有内容
  folderNameElement.innerHTML = '';

  // 检查 bookmarkId 是否有效
  if (!bookmarkId || bookmarkId === 'undefined') {
    folderNameElement.textContent = getLocalizedMessage('bookmarks');
    return;
  }

  // 尝试获取书签路径
  getBookmarkPath(bookmarkId).then(pathArray => {
    let breadcrumbHtml = '';
    let currentPath = '';

    pathArray.forEach((part, index) => {
      currentPath += (index > 0 ? ' > ' : '') + part;
      breadcrumbHtml += `<span class="breadcrumb-item" data-path="${currentPath}">${getLocalizedMessage(part)}</span>`;
      if (index < pathArray.length - 1) {
        breadcrumbHtml += '<span class="breadcrumb-separator">&gt;</span>';
      }
    });

    folderNameElement.innerHTML = breadcrumbHtml;
    addBreadcrumbClickListeners();
  }).catch(error => {
    console.warn('Error updating folder name:', error);
    // 设置默认文本，并确保它被本地化
    folderNameElement.textContent = getLocalizedMessage('bookmarks');
  });
}

function addBreadcrumbClickListeners() {
  const breadcrumbItems = document.querySelectorAll('.breadcrumb-item');
  breadcrumbItems.forEach(item => {
    item.addEventListener('click', function () {
      const path = this.dataset.path;
      navigateToPath(path);
    });
  });
}

function navigateToPath(path) {
  const pathParts = path.split(' > ');
  
  // 获取书签栏的名称
  getBookmarksBarName().then(bookmarksBarName => {
    let currentId = '1'; // 默认从根目录开始
    let startIndex = 0;

    // 如果路径不是从书签栏开始，我们需要找到正确的起始点
    if (pathParts[0] !== bookmarksBarName) {
      chrome.bookmarks.search({title: pathParts[0]}, function(results) {
        if (results.length > 0) {
          currentId = results[0].id;
        }
        navigateRecursive(startIndex);
      });
    } else {
      startIndex = 1; // 如果从书签栏开始，跳过第一个元素
      navigateRecursive(startIndex);
    }

    function navigateRecursive(index) {
      if (index >= pathParts.length) {
        updateBookmarksDisplay(currentId);
        return;
      }

      chrome.bookmarks.getChildren(currentId, function(children) {
        const matchingChild = children.find(child => child.title === pathParts[index]);
        if (matchingChild) {
          currentId = matchingChild.id;
          navigateRecursive(index + 1);
        } else {
          updateBookmarksDisplay(currentId);
        }
      });
    }
  });
}


Object.assign(S, { initDefaultFoldersTabs, initWheelSwitching, switchToFolder, updateBookmarksDisplay, getBookmarksBarName, getBookmarkPath, updateFolderName, addBreadcrumbClickListeners, navigateToPath, updateDefaultBookmarkIndicator, updateSidebarDefaultBookmarkIndicator, selectSidebarFolder });
