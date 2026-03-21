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
function showConfirmDialog(message, callback) {
  // 先保存当前状态的副本
  const currentState = {
    itemToDelete: itemToDelete ? { ...itemToDelete } : null,
    currentBookmark: currentBookmark ? { ...currentBookmark } : null,
    type: itemToDelete ? itemToDelete.type : 'unknown'  // 从 itemToDelete 获取类型
  };
  
  console.log('Current state:', currentState);
  
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmQuickLinkMessage = document.getElementById('confirm-delete-quick-link-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空所有确认消息
  confirmMessage.innerHTML = '';
  if (confirmQuickLinkMessage) {
    confirmQuickLinkMessage.innerHTML = '';
    confirmQuickLinkMessage.style.display = 'none';
  }
  
  // 根据 itemToDelete 的类型显示相应的消息
  if (itemToDelete && itemToDelete.type === 'quickLink') {
    if (confirmQuickLinkMessage) {
      confirmQuickLinkMessage.innerHTML = message;
      confirmQuickLinkMessage.style.display = 'block';
      confirmMessage.style.display = 'none';
    }
  } else {
    confirmMessage.innerHTML = message;
    confirmMessage.style.display = 'block';
    if (confirmQuickLinkMessage) {
      confirmQuickLinkMessage.style.display = 'none';
    }
  }

  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('Confirm clicked. Current state:', currentState);
    if (typeof callback === 'function') {
      callback();
    }
    confirmDialog.style.display = 'none';
    cleanup();
  };

  const handleCancel = () => {
    console.log('Cancel clicked. Clearing state...');
    confirmDialog.style.display = 'none';
    
    // 清空所有确认消息
    confirmMessage.innerHTML = '';
    confirmMessage.style.display = 'block';
    if (confirmQuickLinkMessage) {
      confirmQuickLinkMessage.innerHTML = '';
      confirmQuickLinkMessage.style.display = 'none';
    }
    
    // 使用之前保存的状态副本记录日志
    console.log('State before cancel:', currentState);
    
    clearAllStates();
    cleanup();
  };

  const cleanup = () => {
    console.log('Cleaning up event listeners');
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
  };

  // 移除旧的事件监听器并添加新的
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

// 新增一个函数来清理所有状态
function clearAllStates() {
  itemToDelete = null;
  currentBookmark = null;
  
  // 隐藏上下文菜单
  if (contextMenu) {
    contextMenu.style.display = 'none';
  }
}

function handleBookmarkDeletion() {
  console.log('=== Handling Bookmark Deletion ===');
  console.log('Current itemToDelete:', itemToDelete);
  
  if (!itemToDelete || !itemToDelete.data) {
    console.error('No valid bookmark to delete');
    Utilities.showToast(getLocalizedMessage('deleteBookmarkError'));
    clearAllStates();
    return;
  }

  // 关闭确认对话框
  const confirmDialog = document.getElementById('confirm-dialog');
  if (confirmDialog) {
    confirmDialog.style.display = 'none';
  }

  // 执行删除操作
  deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);

  // 清理状态
  clearAllStates();
}

function deleteBookmark(bookmarkId, bookmarkTitle) {
  if (!bookmarkId) {
    console.error('No bookmark ID provided for deletion');
    return;
  }

  // 先从界面上移除书签卡片
  const bookmarkCard = document.querySelector(`.bookmark-card[data-id="${bookmarkId}"]`);
  if (bookmarkCard) {
    // 添加淡出动画
    bookmarkCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    bookmarkCard.style.opacity = '0';
    bookmarkCard.style.transform = 'scale(0.95)';
    
    // 等待动画完成后移除元素
    setTimeout(() => {
      bookmarkCard.remove();
    }, 300);
  }

  // 然后调用 Chrome API 删除书签
  chrome.bookmarks.remove(bookmarkId, function() {
    if (chrome.runtime.lastError) {
      console.error('Error deleting bookmark:', chrome.runtime.lastError);
      Utilities.showToast(getLocalizedMessage('deleteBookmarkError'));
      
      // 如果删除失败，恢复书签卡片
      if (bookmarkCard && bookmarkCard.parentNode) {
        bookmarkCard.style.opacity = '1';
        bookmarkCard.style.transform = 'scale(1)';
      }
    } else {
      // 保留成功删除的日志，但简化
      Utilities.showToast(getLocalizedMessage('deleteSuccess'));
      
      // 清除相关缓存
      bookmarksCache.clear();
      
      // 更新父文件夹的显示
      const parentId = document.getElementById('bookmarks-list').dataset.parentId;
      if (parentId) {
        // 不需要完全刷新，因为我们已经从界面上移除了书签卡片
        // 但我们需要更新缓存和排序
        chrome.bookmarks.getChildren(parentId, (bookmarks) => {
          if (!chrome.runtime.lastError) {
            bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);
          }
        });
      }
    }
  });
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('Toast element not found');
    return;
  }
  toast.textContent = message;
  toast.style.display = 'block';
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duration);
}



function createFolderCard(folder, index) {
  const card = document.createElement('div');
  card.className = 'bookmark-folder card';
  card.dataset.id = folder.id;
  card.dataset.parentId = folder.parentId;
  card.dataset.index = index.toString();

  const icon = document.createElement('span');
  icon.className = 'material-icons mr-2';
  icon.innerHTML = ICONS.folder;
  
  const content = document.createElement('div');
  content.className = 'card-content';
  
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = folder.title;
  
  content.appendChild(title);
  card.appendChild(icon);
  card.appendChild(content);

  // Add click event handler to display folder contents
  card.addEventListener('click', function() {
    updateBookmarksDisplay(folder.id);
    updateFolderName(folder.id);
  });

  // 从缓存获取文件夹颜色
  const cachedColors = ColorCache.get(folder.id, 'folder');
  if (cachedColors) {
    applyColors(card, cachedColors);
  } else {
    // 为文件夹生成默认颜色
    const defaultColors = {
      primary: [230, 230, 230],    // 稍微浅一点的灰色
      secondary: [240, 240, 240]    // 更浅的灰色
    };
    applyColors(card, defaultColors);
    ColorCache.set(folder.id, 'folder', defaultColors);
  }

  // 修改右键点击事件，使用文件夹的上下文菜单
  card.addEventListener('contextmenu', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Folder card right click:', {
      folderId: card.dataset.id,
      folderTitle: card.querySelector('.card-title')?.textContent
    });
    
    // 确保文件夹上下文菜单存在
    if (!bookmarkFolderContextMenu) {
      bookmarkFolderContextMenu = createBookmarkFolderContextMenu();
    }

    if (!bookmarkFolderContextMenu) {
      console.error('Failed to create bookmark folder context menu');
      return;
    }

    // 更新当前文件夹
    currentBookmarkFolder = card;
    
    // 重新创建菜单项以反映当前文件夹的状态
    await createMenuItems(bookmarkFolderContextMenu);
    
    // 先显示菜单但设为不可见，以便获取其尺寸
    bookmarkFolderContextMenu.style.display = 'block';
    bookmarkFolderContextMenu.style.visibility = 'hidden';
    bookmarkFolderContextMenu.style.left = '0';
    bookmarkFolderContextMenu.style.top = '0';
    
    // 获取视窗尺寸
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 等待一下以确保菜单已渲染
    setTimeout(() => {
      const menuRect = bookmarkFolderContextMenu.getBoundingClientRect();
      
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
      bookmarkFolderContextMenu.style.left = `${left}px`;
      bookmarkFolderContextMenu.style.top = `${top}px`;
      
      // 使菜单可见
      bookmarkFolderContextMenu.style.visibility = 'visible';
    }, 0);

    // 隐藏其他上下文菜单
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
  });

  return card;
}


Object.assign(S, { handleBookmarkDeletion, deleteBookmark, showToast, createFolderCard });
