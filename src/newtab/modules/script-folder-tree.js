import { ICONS } from '../icons.js';
import { createUtilities } from '../bookmark-actions.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const getLocalizedMessage = (...args) => S.getLocalizedMessage(...args);
const Utilities = createUtilities(getLocalizedMessage);

function removeBookmarkTree(folderId) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(folderId, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

function displayBookmarkCategories(bookmarkNodes, level, parentUl, parentId) {
  const categoriesList = parentUl || document.getElementById('categories-list');

  // 如果是根级调用，先清空现有内容
  if (!parentUl) {
    categoriesList.innerHTML = '';
  }

  if (parentId === '1') {
    categoriesList.style.display = 'block';
  }

  bookmarkNodes.forEach(function (bookmark) {
    if (bookmark.children && bookmark.children.length > 0) {
      let li = document.createElement('li');
      li.className = 'cursor-pointer p-2 hover:bg-emerald-500 rounded-lg flex items-center folder-item';
      li.style.paddingLeft = `${(level * 20) + 8}px`;
      li.dataset.title = bookmark.title;
      li.dataset.id = bookmark.id;

      let span = document.createElement('span');
      span.textContent = bookmark.title;

      const folderIcon = document.createElement('span');
      folderIcon.className = 'material-icons mr-2';
      folderIcon.innerHTML = ICONS.folder;
      li.insertBefore(folderIcon, li.firstChild);

      const hasSubfolders = bookmark.children.some(child => child.children);
      let arrowIcon;
      if (hasSubfolders) {
        arrowIcon = document.createElement('span');
        arrowIcon.className = 'material-icons ml-auto';
        arrowIcon.innerHTML = ICONS.chevron_right;
        li.appendChild(arrowIcon);
      }

      let sublist = document.createElement('ul');
      sublist.className = 'pl-4 space-y-2';
      sublist.style.display = 'none';

      li.addEventListener('click', function (event) {
        event.stopPropagation();
        if (hasSubfolders) {
          let isExpanded = sublist.style.display === 'block';
          sublist.style.display = isExpanded ? 'none' : 'block';
          if (arrowIcon) {
            arrowIcon.innerHTML = isExpanded ? ICONS.chevron_right : ICONS.expand_less;
          }
        }

        document.querySelectorAll('#categories-list li').forEach(function (item) {
          item.classList.remove('bg-emerald-500');
        });
        li.classList.add('bg-emerald-500');

        S.updateBookmarksDisplay(bookmark.id);
      });

      li.appendChild(span);
      categoriesList.appendChild(li);
      categoriesList.appendChild(sublist);

      displayBookmarkCategories(bookmark.children, level + 1, sublist, bookmark.id);
    }
  });

  S.setupSortable();
}

// 添加一个获取文件夹内书签数量的函数
// 新增辅助函数
async function isDefaultFolder(folderId) {
  if (!folderId) return false;

  const data = await chrome.storage.sync.get('defaultFolders');
  const defaultFolders = data.defaultFolders?.items || [];
  return defaultFolders.some(folder => folder.id === folderId);
}
// 创建文件夹上下文菜单
function createBookmarkFolderContextMenu() {
  console.log('Creating folder context menu');

  // 移除任何已存在的上下文菜单
  const existingMenu = document.querySelector('.bookmark-folder-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'bookmark-folder-context-menu custom-context-menu';
  document.body.appendChild(menu);

  // 异步创建菜单项
  createMenuItems(menu).catch(error => {
    console.error('Error creating menu items:', error);
  });

  return menu;
}

function openEditBookmarkFolderDialog(folderElement) {
  if (!folderElement?.dataset?.id) {
    return;
  }

  const dialog = document.getElementById('edit-category-dialog');
  const form = document.getElementById('edit-category-form');
  const input = document.getElementById('edit-category-name');
  const closeButton = document.querySelector('.close-category-button');
  const cancelButton = document.querySelector('.cancel-category-button');

  if (!dialog || !form || !input) {
    console.warn('edit category dialog is not available');
    return;
  }

  const folderId = folderElement.dataset.id;
  input.value = folderElement.querySelector('.card-title')?.textContent || folderElement.dataset.title || '';
  dialog.style.display = 'block';

  const closeDialog = () => {
    dialog.style.display = 'none';
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    const nextTitle = input.value.trim();
    if (!nextTitle) {
      return;
    }

    chrome.bookmarks.update(folderId, { title: nextTitle }, async () => {
      if (chrome.runtime.lastError) {
        console.error('Error updating folder title:', chrome.runtime.lastError);
        Utilities.showToast(getLocalizedMessage('renameFolderError') || '重命名文件夹失败');
        return;
      }

      const titleElement = folderElement.querySelector('.card-title');
      if (titleElement) {
        titleElement.textContent = nextTitle;
      }
      folderElement.dataset.title = nextTitle;

      const sidebarFolder = document.querySelector(`#categories-list li[data-id="${folderId}"]`);
      if (sidebarFolder) {
        sidebarFolder.dataset.title = nextTitle;
        const textSpan = sidebarFolder.querySelector('span:not(.material-icons):not(.icon-svg)');
        if (textSpan) {
          textSpan.textContent = nextTitle;
        }
      }

      const parentId = folderElement.dataset.parentId || document.getElementById('bookmarks-list')?.dataset?.parentId || '1';
      if (typeof S.invalidateBookmarkCache === 'function') {
        S.invalidateBookmarkCache([folderId, parentId]);
      }
      if (typeof S.refreshBookmarkTree === 'function') {
        await S.refreshBookmarkTree();
      }
      if (typeof S.updateFolderName === 'function') {
        S.updateFolderName(document.getElementById('bookmarks-list')?.dataset?.parentId || parentId);
      }

      closeDialog();
    });
  };

  if (closeButton) {
    closeButton.onclick = closeDialog;
  }
  if (cancelButton) {
    cancelButton.onclick = closeDialog;
  }
}

async function createMenuItems(menu) {  
  console.log('=== Creating Menu Items ===');
  console.log('Current bookmark folder:', S.currentBookmarkFolder);
  
  // 清空现有菜单项
  menu.innerHTML = '';

  const menuItems = [
    { 
      text: getLocalizedMessage('openAllBookmarks'),
      icon: 'open_in_new',  
      action: () => {
        if (S.currentBookmarkFolder) {
          const folderId = S.currentBookmarkFolder.dataset.id;
          const folderTitle = S.currentBookmarkFolder.querySelector('.card-title').textContent;
          
          chrome.bookmarks.getChildren(folderId, (bookmarks) => {
            // 过滤出有效的书签URL
            const validUrls = bookmarks
              .filter(bookmark => bookmark.url)
              .map(bookmark => bookmark.url);

            if (validUrls.length > 0) {
              // 使用 chrome.runtime.sendMessage 发送消息给后台脚本
              chrome.runtime.sendMessage({
                action: 'openMultipleTabsAndGroup',
                urls: validUrls,
                groupName: folderTitle // 使用文件夹名称作为标签组名称
              }, (response) => {
                if (response.success) {
                  console.log('Bookmarks opened in new tab group');
                } else {
                  console.error('Error opening bookmarks:', response.error);
                }
              });
            }
          });
        }
      }
    },
    // 原有的菜单项
    { text: getLocalizedMessage('rename'), icon: 'edit', action: () => S.currentBookmarkFolder && S.openEditBookmarkFolderDialog(S.currentBookmarkFolder) },
    { text: getLocalizedMessage('delete'), icon: 'delete', action: () => {
      if (S.currentBookmarkFolder) {
        const folderId = S.currentBookmarkFolder.dataset.id;
        const folderTitle = S.currentBookmarkFolder.querySelector('.card-title').textContent;
        const parentId = S.currentBookmarkFolder.dataset.parentId || '1';
        
        S.showConfirmDialog(chrome.i18n.getMessage("confirmDeleteFolder", [`<strong>${folderTitle}</strong>`]), async () => {
          try {
            await removeBookmarkTree(folderId);
            
            // 1. 立即从 UI 中移除文件夹卡片
            const folderCard = document.querySelector(`.bookmark-folder[data-id="${folderId}"]`);
            if (folderCard) {
              folderCard.remove();
            }
            
            // 2. 从侧边栏中移除对应的文件夹及其所有子文件夹
            const sidebarFolder = document.querySelector(`#categories-list li[data-id="${folderId}"]`);
            if (sidebarFolder) {
              // 获取并移除所有子文件夹
              const subFolders = sidebarFolder.querySelectorAll('ul');
              subFolders.forEach(ul => ul.remove());
              sidebarFolder.remove();
            }

            // 3. 清除相关缓存
            if (typeof S.invalidateBookmarkCache === 'function') {
              S.invalidateBookmarkCache([folderId, parentId]);
            }
            if (typeof S.invalidateFolderPreviewCache === 'function') {
              S.invalidateFolderPreviewCache([folderId, parentId]);
            }
            
            // 4. 显示删除成功的 toast 消息
            Utilities.showToast(getLocalizedMessage('deleteSuccess'));

            // 5. 如果删除的是当前显示的文件夹，则返回上一级并重新加载
            const bookmarksList = document.getElementById('bookmarks-list');
            if (bookmarksList.dataset.parentId === folderId) {
              await S.updateBookmarksDisplay(parentId);
              S.updateFolderName(parentId);
              S.selectSidebarFolder(parentId);
            }

            // 6. 重新加载父文件夹的内容和预览
            if (document.getElementById('bookmarks-list')?.dataset?.parentId === parentId) {
              await S.updateBookmarksDisplay(parentId);
            }

          } catch (error) {
            console.error('Error deleting folder:', error);
            Utilities.showToast(getLocalizedMessage('deleteFolderError'));
          }
        });
      }
    }}
  ];

  // 创建菜单项
  menuItems.forEach((item, index) => {
    console.log(`Creating menu item ${index}:`, {
      text: item.text,
      icon: item.icon
    });
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    const icon = document.createElement('span');
    icon.className = 'icon-svg';
    icon.innerHTML = ICONS[item.icon];
    
    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = item.text;

    menuItem.appendChild(icon);
    menuItem.appendChild(text);
    menuItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      await item.action();
      setTimeout(() => {
        menu.style.display = 'none';
      }, 100);
    });

    menu.appendChild(menuItem);
  });
}

assignToScriptState({
  displayBookmarkCategories,
  isDefaultFolder,
  createBookmarkFolderContextMenu,
  createMenuItems,
  openEditBookmarkFolderDialog
});
