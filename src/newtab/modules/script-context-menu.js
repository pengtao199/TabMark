import { ICONS } from '../icons.js';
import { showQrCodeModal } from '../qrcode-modal.js';
import { openInNewWindow, openInIncognito, createUtilities } from '../bookmark-actions.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const getLocalizedMessage = (...args) => (
  typeof S.getLocalizedMessage === 'function' ? S.getLocalizedMessage(...args) : (args[0] || '')
);
const Utilities = createUtilities(getLocalizedMessage);
let contextMenu = null;
let currentBookmark = null;
let itemToDelete = null;

function stripHtml(input = '') {
  return String(input).replace(/<[^>]*>/g, '');
}

function showConfirmDialog(message, callback) {
  if (typeof S.showConfirmDialog === 'function') {
    S.showConfirmDialog(message, callback);
    return;
  }
  if (window.confirm(stripHtml(message)) && typeof callback === 'function') {
    callback();
  }
}

function deleteBookmark(bookmarkId, bookmarkTitle) {
  if (typeof S.deleteBookmark === 'function') {
    S.deleteBookmark(bookmarkId, bookmarkTitle);
    return;
  }
  if (!bookmarkId) {
    return;
  }
  chrome.bookmarks.remove(bookmarkId, () => {
    if (chrome.runtime.lastError) {
      console.error('Error deleting bookmark:', chrome.runtime.lastError);
      Utilities.showToast('删除书签失败');
      return;
    }

    const parentId = document.getElementById('bookmarks-list')?.dataset?.parentId || '1';
    Promise.resolve()
      .then(() => {
        if (typeof S.invalidateBookmarkCache === 'function') {
          S.invalidateBookmarkCache([parentId]);
        }
        if (typeof S.refreshBookmarkTree === 'function') {
          return S.refreshBookmarkTree();
        }
        return null;
      })
      .then(() => {
        if (typeof S.updateBookmarksDisplay === 'function') {
          return S.updateBookmarksDisplay(parentId);
        }
        return null;
      })
      .then(() => {
        if (typeof S.updateFolderName === 'function') {
          S.updateFolderName(parentId);
        }
        Utilities.showToast('书签已删除');
      })
      .catch((error) => {
        console.error('Error refreshing after bookmark deletion:', error);
        Utilities.showToast('删除成功，但刷新失败');
      });
  });
}

function deleteQuickLink(item) {
  if (typeof S.deleteQuickLink === 'function') {
    S.deleteQuickLink(item);
    return;
  }
  console.warn('deleteQuickLink is not available');
}

function openEditDialog(item) {
  if (!item?.id) {
    return;
  }

  const editDialog = document.getElementById('edit-dialog');
  const editForm = document.getElementById('edit-form');
  const editNameInput = document.getElementById('edit-name');
  const editUrlInput = document.getElementById('edit-url');
  const cancelButton = editDialog?.querySelector('.cancel-button');
  const closeButton = editDialog?.querySelector('.close-button');

  if (!editDialog || !editForm || !editNameInput || !editUrlInput) {
    console.warn('edit dialog is not available');
    return;
  }

  editNameInput.value = item.title || '';
  editUrlInput.value = item.url || '';
  editDialog.style.display = 'block';

  const closeEditDialog = () => {
    editDialog.style.display = 'none';
  };

  editForm.onsubmit = async (event) => {
    event.preventDefault();
    const nextTitle = editNameInput.value.trim();
    const nextUrl = editUrlInput.value.trim();

    if (!nextTitle || !nextUrl) {
      Utilities.showToast('请填写完整书签信息');
      return;
    }

    chrome.bookmarks.update(item.id, { title: nextTitle, url: nextUrl }, async () => {
      if (chrome.runtime.lastError) {
        console.error('Error updating bookmark:', chrome.runtime.lastError);
        Utilities.showToast('编辑书签失败');
        return;
      }

      const parentId = document.getElementById('bookmarks-list')?.dataset?.parentId || '1';
      if (typeof S.invalidateBookmarkCache === 'function') {
        S.invalidateBookmarkCache([parentId]);
      }
      if (typeof S.refreshBookmarkTree === 'function') {
        await S.refreshBookmarkTree();
      }
      if (typeof S.updateBookmarksDisplay === 'function') {
        await S.updateBookmarksDisplay(parentId);
      }
      if (typeof S.updateFolderName === 'function') {
        S.updateFolderName(parentId);
      }

      Utilities.showToast('书签已更新');
      closeEditDialog();
    });
  };

  if (cancelButton) {
    cancelButton.onclick = closeEditDialog;
  }
  if (closeButton) {
    closeButton.onclick = closeEditDialog;
  }
}

function createContextMenu() {
  console.log('Creating context menu');

  const existingMenu = document.querySelector('.custom-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  document.body.appendChild(menu);
  contextMenu = menu;
  S.contextMenu = menu;

  createContextMenuItems(menu, S.currentBookmark?.type || 'bookmark');
  return menu;
}
function showContextMenu(event, item, type = 'bookmark') {
  // 先关闭所有已存在的上下文菜单
  const existingMenus = document.querySelectorAll('.custom-context-menu');
  existingMenus.forEach(menu => {
    if (menu !== contextMenu && menu.style.display !== 'none') {
      menu.style.display = 'none';
    }
  });

  // 如果上下文菜单不存在，则创建一个新的
  if (!contextMenu) {
    contextMenu = createContextMenu();
  }
  S.contextMenu = contextMenu;

  if (!contextMenu) {
    console.error('Failed to create context menu');
    return;
  }

  // 清除之前的状态
  itemToDelete = null;
  currentBookmark = null;
  S.itemToDelete = null;
  S.currentBookmark = null;
  
  // 设置当前项目，确保包含类型信息
  currentBookmark = {
    id: item.id || item.dataset?.id,
    title: item.title || item.querySelector?.('.card-title')?.textContent || item.querySelector?.('span')?.textContent,
    url: item.url || item.dataset?.url,
    type: item.type || type  // 优先使用项目自带的类型，否则使用传入的类型
  };
  S.currentBookmark = currentBookmark;

  // 先显示菜单但设为不可见，以便获取其尺寸
  contextMenu.style.display = 'block';
  contextMenu.style.visibility = 'hidden';
  contextMenu.style.left = '0';
  contextMenu.style.top = '0';
  
  // 获取视窗尺寸
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // 等待一下以确保菜单已渲染
  setTimeout(() => {
    const menuRect = contextMenu.getBoundingClientRect();
    
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
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    
    // 使菜单可见
    contextMenu.style.visibility = 'visible';
  }, 0);
}

function hideContextMenu() {
  if (!contextMenu) {
    return;
  }
  contextMenu.style.display = 'none';
  currentBookmark = null;
  itemToDelete = null;
  S.currentBookmark = null;
  S.itemToDelete = null;
}

// 右键菜单的兜底关闭机制：点击空白区域时一定关闭
document.addEventListener('click', (event) => {
  if (!contextMenu) {
    return;
  }
  if (contextMenu.contains(event.target)) {
    return;
  }
  hideContextMenu();
});

document.addEventListener('contextmenu', (event) => {
  if (!contextMenu) {
    return;
  }
  if (event.target.closest('.bookmark-card') || event.target.closest('.quick-link-item-container')) {
    return;
  }
  hideContextMenu();
});



// 新增函数：根据类型创建菜单项
function createContextMenuItems(menu, type) {
  const menuItems = [
    { text: getLocalizedMessage('openInNewTab'), icon: 'open_in_new', action: () => currentBookmark && window.open(currentBookmark.url, '_blank') },
    { text: getLocalizedMessage('openInNewWindow'), icon: 'launch', action: () => currentBookmark && openInNewWindow(currentBookmark.url) },
    { text: getLocalizedMessage('openInIncognito'), icon: 'visibility_off', action: () => currentBookmark && openInIncognito(currentBookmark.url) },
    { text: getLocalizedMessage('editQuickLink'), icon: 'edit', action: () => currentBookmark && openEditDialog(currentBookmark) },
    { 
      text: type === 'quickLink' ? getLocalizedMessage('deleteQuickLink') : getLocalizedMessage('deleteBookmark'), 
      icon: 'delete', 
      action: () => {
        console.log('=== Delete Action Triggered ===');
        console.log('Current bookmark:', currentBookmark);
        console.log('Menu type:', type);
        
        if (!currentBookmark) {
          console.error('No item selected for deletion');
          return;
        }

        // 使用全局的 itemToDelete 变量
        itemToDelete = {
          type: currentBookmark.type,  // 使用当前项目的类型
          data: {
            id: currentBookmark.id,
            title: currentBookmark.title,
            url: currentBookmark.url,
            type: currentBookmark.type  // 确保在 data 中也保存类型信息
          }
        };
        
        console.log('Set itemToDelete:', itemToDelete);
        
        // 根据类型显示不同的确认消息
        const message = itemToDelete.type === 'quickLink' 
          ? chrome.i18n.getMessage("confirmDeleteQuickLink", [`<strong>${itemToDelete.data.title}</strong>`])
          : chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${itemToDelete.data.title}</strong>`]);
        
        console.log('Showing confirmation dialog with message:', message);
        
        showConfirmDialog(message, () => {
          console.log('=== Delete Confirmation Callback ===');
          console.log('itemToDelete:', itemToDelete);
          
          if (itemToDelete && itemToDelete.data) {
            if (itemToDelete.type === 'quickLink') {
              console.log('Deleting quick link:', itemToDelete.data);
              deleteQuickLink(itemToDelete.data);
            } else {
              console.log('Deleting bookmark:', itemToDelete.data);
              deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);
            }
          } else {
            console.error('Invalid itemToDelete state:', itemToDelete);
          }
        });
      }
    },
    { text: getLocalizedMessage('copyLink'), icon: 'content_copy', action: () => currentBookmark && Utilities.copyBookmarkLink(currentBookmark) },
    { text: getLocalizedMessage('createQRCode'), icon: 'qr_code', action: () => currentBookmark && showQrCodeModal(currentBookmark.url, currentBookmark.title, getLocalizedMessage) }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.innerHTML = ICONS[item.icon];
    icon.style.marginRight = '8px';
    icon.style.fontSize = '18px';
    
    const text = document.createElement('span');
    text.textContent = item.text;

    menuItem.appendChild(icon);
    menuItem.appendChild(text);

    menuItem.addEventListener('click', () => {
      if (typeof item.action === 'function') {
        item.action();
      }
      menu.style.display = 'none';
    });

    menu.appendChild(menuItem);
  });
}

function showDeleteConfirmDialog() {
  if (!itemToDelete || !itemToDelete.data) {
    console.error('Invalid delete item:', itemToDelete);
    return;
  }

  console.log('=== Showing Delete Confirm Dialog ===');
  console.log('Item to delete:', itemToDelete);

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空之前的消息
  confirmMessage.innerHTML = '';
  
  // 根据类型显示不同的确认消息
  const message = itemToDelete.type === 'quickLink' 
    ? chrome.i18n.getMessage("confirmDeleteQuickLink", [`<strong>${itemToDelete.data.title}</strong>`])
    : chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${itemToDelete.data.title}</strong>`]);
  confirmMessage.innerHTML = message;
  
  console.log('Showing confirmation dialog for:', {
    type: itemToDelete.type,
    title: itemToDelete.data.title
  });
  
  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('=== Delete Confirmed ===');
    console.log('Deleting item:', itemToDelete);
    
    if (itemToDelete.type === 'quickLink') {
      deleteQuickLink(itemToDelete.data);
    } else {
      deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);
    }
    
    confirmDialog.style.display = 'none';
    cleanup();
    itemToDelete = null;
  };

  const handleCancel = () => {
    console.log('=== Delete Cancelled ===');
    console.log('Cancelled item:', itemToDelete);
    confirmDialog.style.display = 'none';
    cleanup();
    itemToDelete = null;
  };

  const cleanup = () => {
    console.log('Cleaning up event listeners and state');
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
    itemToDelete = null;
  };

  // 设置事件监听器
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

// 在创建快捷链接卡片时
function createQuickLinkCard(quickLink) {
  const card = document.createElement('div');
  card.className = 'quick-link-item-container';
  card.dataset.url = quickLink.url;
  card.dataset.id = quickLink.id;
  card.dataset.type = 'quickLink';  // 明确设置类型

  // ... 其他代码保持不变 ...

  card.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    console.log('=== Quick Link Context Menu Triggered ===');
    console.log('Quick link data:', quickLink);
    console.log('Card dataset:', this.dataset);
    
    // 构造完整的快捷链接对象
    const quickLinkData = {
      id: quickLink.id || this.dataset.id,
      title: quickLink.title || this.querySelector('span').textContent,
      url: quickLink.url || this.dataset.url,
      type: 'quickLink'  // 明确指定类型
    };
    
    console.log('Constructed quickLinkData:', quickLinkData);
    showContextMenu(event, quickLinkData, 'quickLink');
  });

  // ... 其他代码保持不变 ...
}

// 在确认对话框关闭时清理数据
function closeConfirmDialog() {
  const confirmDialog = document.getElementById('confirm-dialog');
  if (confirmDialog) {
    confirmDialog.style.display = 'none';
    // 清理所有相关数据
    currentBookmark = null;
    itemToDelete = null;
  }
}

// 分别定义两个函数处理不同类型的删除
function confirmBookmarkDeletion(bookmark) {
  console.log('=== Starting Bookmark Deletion Process ===');
  console.log('Input bookmark:', bookmark);
  console.log('Current states before setting:', {
    itemToDelete,
    currentBookmark
  });

  if (!bookmark || !bookmark.id) {
    console.error('Invalid bookmark data:', bookmark);
    return;
  }

  // 设置当前要删除的书签
  itemToDelete = { ...bookmark };
  
  console.log('States after setting bookmark:', {
    itemToDelete,
    currentBookmark
  });

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空之前的消息
  confirmMessage.innerHTML = '';
  
  // 只显示书签删除的确认消息
  confirmMessage.innerHTML = chrome.i18n.getMessage(
    "confirmDeleteBookmark", 
    [`<strong>${bookmark.title}</strong>`]
  );
  
  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('=== Bookmark Deletion Confirmed ===');
    console.log('Deleting bookmark:', itemToDelete);
    deleteBookmark(itemToDelete);
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const handleCancel = () => {
    console.log('=== Bookmark Deletion Cancelled ===');
    console.log('States before cleanup:', {
      itemToDelete,
      currentBookmark
    });
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const cleanup = () => {
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
  };

  // 设置事件监听器
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

function confirmQuickLinkDeletion(quickLink) {
  console.log('=== Starting QuickLink Deletion Process ===');
  console.log('Input quickLink:', quickLink);
  console.log('Current states before setting:', {
    itemToDelete,
    currentBookmark
  });

  if (!quickLink || !quickLink.id) {
    console.error('Invalid quick link data:', quickLink);
    return;
  }

  // 设置当前要删除的快捷链接
  itemToDelete = { ...quickLink };

  console.log('States after setting quickLink:', {
    itemToDelete,
    currentBookmark
  });

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空之前的消息
  confirmMessage.innerHTML = '';
  
  // 只显示快捷链接删除的确认消息
  confirmMessage.innerHTML = chrome.i18n.getMessage(
    "confirmDeleteQuickLink", 
    [`<strong>${quickLink.title}</strong>`]
  );
  
  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('=== QuickLink Deletion Confirmed ===');
    console.log('Deleting quickLink:', itemToDelete);
    deleteQuickLink(itemToDelete);
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const handleCancel = () => {
    console.log('=== QuickLink Deletion Cancelled ===');
    console.log('States before cleanup:', {
      itemToDelete,
      currentBookmark
    });
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const cleanup = () => {
    console.log('Cleaning up QuickLink deletion event listeners');
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
  };

  // 设置事件监听器
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

// 新增：清理所有删除相关的状态
function clearDeleteStates() {
  console.log('=== Clearing All Delete States ===');
  console.log('States before clearing:', {
    itemToDelete,
    currentBookmark
  });
  
  itemToDelete = null;
  currentBookmark = null;
  
  console.log('States after clearing:', {
    itemToDelete,
    currentBookmark
  });
}

// 修改 showConfirmDialog 函数

assignToScriptState({
  createContextMenu,
  showContextMenu,
  createContextMenuItems,
  showDeleteConfirmDialog,
  createQuickLinkCard,
  closeConfirmDialog,
  confirmBookmarkDeletion,
  confirmQuickLinkDeletion,
  clearDeleteStates,
  showConfirmDialog: S.showConfirmDialog,
  clearAllStates: S.clearAllStates
});
