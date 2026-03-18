import {
  featureTips,
  initGestureNavigation,
  updateSearchEngineIcon,
  replaceIconsWithSvg,
  onDomReadyOnce
} from './script-shared-init.js';
import { getScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
let bookmarkTreeNodes = [];
let defaultSearchEngine = 'google';
let contextMenu = null;
let currentBookmark = null;

// 使用单一的状态变量
let itemToDelete = null;

let bookmarkFolderContextMenu = null;
let currentBookmarkFolder = null;
let lastStorageWrite = 0;
let pendingWrite = null;
const STORAGE_WRITE_INTERVAL = 1000; // 1秒的节流间隔

// 编辑书签对话框函数
function openEditDialog(bookmark) {
  const bookmarkId = bookmark.id;
  const bookmarkTitle = bookmark.title;
  const bookmarkUrl = bookmark.url;

  document.getElementById('edit-name').value = bookmarkTitle;
  document.getElementById('edit-url').value = bookmarkUrl;

  const editDialog = document.getElementById('edit-dialog');
  editDialog.style.display = 'block';

  // 设置提交事件
  document.getElementById('edit-form').onsubmit = function (event) {
    event.preventDefault();
    const newTitle = document.getElementById('edit-name').value;
    const newUrl = document.getElementById('edit-url').value;
    chrome.bookmarks.update(bookmarkId, { title: newTitle, url: newUrl }, function () {
      editDialog.style.display = 'none';

      // 更新特定的书签卡片
      updateSpecificBookmarkCard(bookmarkId, newTitle, newUrl);
    });
  };

  // 使用覆盖式绑定，避免多次打开弹窗导致重复事件监听
  const cancelButton = document.querySelector('.cancel-button');
  if (cancelButton) {
    cancelButton.onclick = function () {
      editDialog.style.display = 'none';
    };
  }

  const closeButton = document.querySelector('.close-button');
  if (closeButton) {
    closeButton.onclick = function () {
      editDialog.style.display = 'none';
    };
  }
}

onDomReadyOnce('script-init:startup', function () {
  // 应用保存的书签卡片高度设置
  chrome.storage.sync.get('bookmarkCardHeight', (result) => {
    if (result.bookmarkCardHeight) {
      // 创建或更新自定义样式
      let styleElement = document.getElementById('custom-card-height');
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'custom-card-height';
        document.head.appendChild(styleElement);
      }
      
      // 设置卡片高度
      styleElement.textContent = `
        .card {
          height: ${result.bookmarkCardHeight}px !important;
        }
      `;
    }
  });

  // 初始化手势导航，传入 updateBookmarksDisplay 函数
  if (typeof S.updateBookmarksDisplay === 'function') {
    initGestureNavigation(S.updateBookmarksDisplay);
  }
   // 初始化功能提示
  featureTips.initAllTips();
  // 替换所有图标
  replaceIconsWithSvg();

  // 更新这部分代码
  updateSearchEngineIcon(defaultSearchEngine);

  const searchEngineIcon = document.getElementById('search-engine-icon');
  if (searchEngineIcon && searchEngineIcon.src === '') {      
    searchEngineIcon.src = '../images/placeholder-icon.svg';
  }
});
