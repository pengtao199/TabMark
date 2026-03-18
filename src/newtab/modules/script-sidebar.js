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
document.addEventListener('DOMContentLoaded', function () {

  // 在页面加载完成后立即检查 folder-name 元素
  const folderNameElement = document.getElementById('folder-name');

  // 设置一个 MutationObserver 来监视 folder-name 元素的变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
    });
  });

  observer.observe(folderNameElement, { childList: true, subtree: true });

  function expandBookmarkTree(category) {
    let parent = category.parentElement;
    while (parent && parent.id !== 'categories-list') {
      if (parent.classList.contains('folder-item')) {
        const sublist = parent.nextElementSibling;
        if (sublist && sublist.tagName === 'UL') {
          sublist.style.display = 'block';
          const arrowIcon = parent.querySelector('.material-icons.ml-auto');
          if (arrowIcon) {
            arrowIcon.textContent = 'expand_less';
          }
        }
      }
      parent = parent.parentElement;
    }
  }

  function waitForFirstCategoryEdge(attemptsLeft) {
    waitForFirstCategory(attemptsLeft);
  }

  function findBookmarksByParentId(nodes, parentId) {
    if (!nodes) return [];
    let bookmarks = [];
    nodes.forEach(node => {
      if (node.parentId === parentId) {
        bookmarks.push(node);
      }
      if (node.children && node.children.length > 0) {
        bookmarks = bookmarks.concat(findBookmarksByParentId(node.children, parentId));
      }
    });
    return bookmarks;
  }


  function isEdgeBrowser() {
    return /Edg/.test(navigator.userAgent);
  }

  if (isEdgeBrowser()) {
    waitForFirstCategoryEdge(10);
  } else {
    waitForFirstCategory(10);
  }

  const toggleSidebarButton = document.getElementById('toggle-sidebar');
  const sidebarContainer = document.getElementById('sidebar-container');

  // 读保存的侧边栏状态
  const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  // 初状
  function setSidebarState(isCollapsed) {
    if (isCollapsed) {
      sidebarContainer.classList.add('collapsed');
      toggleSidebarButton.textContent = '>';
      toggleSidebarButton.style.left = '2rem'; // 收起时的位置
    } else {
      sidebarContainer.classList.remove('collapsed');
      toggleSidebarButton.textContent = '<';
      toggleSidebarButton.style.left = '14.75rem'; // 展开时的位置
    }
  }

  // 应用初始状态
  setSidebarState(isSidebarCollapsed);

  // 切换侧边状态的函数
  function toggleSidebar() {
    const isCollapsed = sidebarContainer.classList.toggle('collapsed');
    setSidebarState(isCollapsed);
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }

  // 添加点击事件监听器
  toggleSidebarButton.addEventListener('click', toggleSidebar);

  document.addEventListener('click', function (event) {
    if (event.target.closest('#categories-list li')) {
      updateBookmarkCards();
    }
  });

  updateBookmarkCards();

  // 注释掉这个重复的createContextMenu函数定义，使用全局已经定义的函数
  /* function createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);
    // ... 其余函数内容 ...
  } */

  document.addEventListener('click', function () {
    // 延迟处理点击事件，让菜单项的点击事件先执行
    setTimeout(() => {
    if (contextMenu) {
      contextMenu.style.display = 'none';
        currentBookmark = null;
      }
      
      if (bookmarkFolderContextMenu) {
        bookmarkFolderContextMenu.style.display = 'none';
        currentBookmarkFolder = null;
      }
    }, 200);
  });
