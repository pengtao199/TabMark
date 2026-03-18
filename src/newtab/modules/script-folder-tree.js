import { ICONS } from '../icons.js';
import { createUtilities } from '../bookmark-actions.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const getLocalizedMessage = (...args) => S.getLocalizedMessage(...args);
const Utilities = createUtilities(getLocalizedMessage);
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

async function createMenuItems(menu) {  
  console.log('=== Creating Menu Items ===');
  console.log('Current bookmark folder:', S.currentBookmarkFolder);
  
  // 清空现有菜单项
  menu.innerHTML = '';

  // 每次创建菜单时重新检查当前文件夹的状态
  let isDefault = false;
  if (S.currentBookmarkFolder?.dataset?.id) {
    try {
      // 确保在获取状态前等待 chrome.storage.sync.get 完成
      const data = await chrome.storage.sync.get('defaultFolders');
      const defaultFolders = data.defaultFolders?.items || [];
      isDefault = defaultFolders.some(folder => folder.id === S.currentBookmarkFolder.dataset.id);
      
      console.log('Folder status check:', {
        folderId: S.currentBookmarkFolder.dataset.id,
        isDefault: isDefault,
        defaultFolders: defaultFolders,
        folderTitle: S.currentBookmarkFolder.querySelector('.card-title')?.textContent
      });
    } catch (error) {
      console.error('Error checking default folder status:', error);
      isDefault = false;
    }
  }

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
            await chrome.bookmarks.removeTree(folderId);
            
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
            if (S.bookmarksCache.data.has(folderId)) {
              S.bookmarksCache.delete(folderId);
            }
            if (S.bookmarksCache.data.has(parentId)) {
              S.bookmarksCache.delete(parentId);
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

            // 6. 重新加载父文件夹的内容
            const parentFolder = document.querySelector(`.bookmark-folder[data-id="${parentId}"]`);
            if (parentFolder) {
              await S.updateBookmarksDisplay(parentId);
            }

          } catch (error) {
            console.error('Error deleting folder:', error);
            Utilities.showToast(getLocalizedMessage('deleteFolderError'));
          }
        });
      }
    }},
    {
      // 根据当前状态设置文本
      text: isDefault ? getLocalizedMessage('removeFromDefaultFolders') : getLocalizedMessage('addToDefaultFolders'),
      icon: isDefault ? 'keep_off' : 'keep',
      action: async () => {
        const folder = S.currentBookmarkFolder;
        console.log('Toggle default folder action triggered:', {
          folder: folder,
          folderId: folder?.dataset?.id,
          currentIsDefault: isDefault
        });

        if (!folder?.dataset?.id) {
          console.error('No valid folder selected');
          return;
        }

        await S.toggleDefaultFolder(folder);
        
        // 重新获取当前状态
        const data = await chrome.storage.sync.get('defaultFolders');
        const defaultFolders = data.defaultFolders?.items || [];
        const newIsDefault = defaultFolders.some(f => f.id === folder.dataset.id);
        
        console.log('Menu item status update:', {
          oldState: isDefault,
          newState: newIsDefault,
          folderId: folder.dataset.id,
          defaultFolders: defaultFolders
        });

        const menuItem = menu.querySelector(`[data-action="toggleDefault"]`);
        if (menuItem) {
          const newText = getLocalizedMessage(newIsDefault ? 'removeFromDefaultFolders' : 'addToDefaultFolders');
          console.log('Updating menu item text to:', newText);
          
          menuItem.querySelector('.text').textContent = newText;
          const iconElement = menuItem.querySelector('.icon-svg');
          if (iconElement) {
            iconElement.innerHTML = ICONS[newIsDefault ? 'keep_off' : 'keep'];
          }
        }
      }
    }
  ];

  // 创建菜单项
  menuItems.forEach((item, index) => {
    console.log(`Creating menu item ${index}:`, {
      text: item.text,
      icon: item.icon
    });
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    if (item.icon === 'keep' || item.icon === 'keep_off') {
      menuItem.dataset.action = 'toggleDefault';
    }
    
    const icon = document.createElement('span');
    icon.className = 'icon-svg';
    icon.innerHTML = ICONS[item.icon];
    if (item.icon === 'keep' || item.icon === 'keep_off') {
      icon.classList.toggle('selected', isDefault);
    }
    
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

assignToScriptState({ displayBookmarkCategories, isDefaultFolder, createBookmarkFolderContextMenu, createMenuItems });
