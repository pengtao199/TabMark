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
  let currentCategory = null;
  // 递归获取所有书签数量的函数
  const getAllBookmarksCount = async (folderId, maxDepth = 5) => {
    let count = 0;
    let depth = 0;

    async function countBookmarks(id, currentDepth) {
      if (currentDepth > maxDepth) return 0;

      return new Promise((resolve) => {
        chrome.bookmarks.getChildren(id, async (items) => {
          let localCount = 0;

          for (const item of items) {
            if (item.url && item.url.startsWith('http')) {
              localCount++;
            } else if (currentDepth < maxDepth) {
              localCount += await countBookmarks(item.id, currentDepth + 1);
            }
          }

          resolve(localCount);
        });
      });
    }

    count = await countBookmarks(folderId, depth);
    return count;
  };
  // 1. 批量创建标签页的函数
  function createTabsInBatches(urls, groupName, batchSize = 5, delay = 100) {
    return new Promise((resolve) => {
      const tabIds = [];
      let currentBatch = 0;

      function createBatch() {
        const batch = urls.slice(currentBatch, currentBatch + batchSize);
        if (batch.length === 0) {
          // 所有标签页创建完成后，创建标签组
          if (tabIds.length > 1) {
            chrome.tabs.group({ tabIds }, (groupId) => {
              chrome.tabGroups.update(groupId, {
                title: groupName,
                color: 'cyan'
              });
              resolve({ success: true });
            });
          } else {
            resolve({ success: true });
          }
          return;
        }

        // 创建这一批的标签页
        Promise.all(batch.map(url =>
          new Promise((resolve) => {
            chrome.tabs.create({ url, active: false }, (tab) => {
              if (tab) tabIds.push(tab.id);
              resolve();
            });
          })
        )).then(() => {
          currentBatch += batchSize;
          // 添加延迟以避免过快创建标签页
          setTimeout(createBatch, delay);
        });
      }

      createBatch();
    });
  }
  function createCategoryContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);

    // 创建基本菜单项
    const createMenuItems = async (bookmarkCount) => {
      // 检查当前文件夹是否为默认文件夹
      let isDefault = false;
      if (currentCategory?.dataset?.id) {
        try {
          const data = await chrome.storage.sync.get('defaultFolders');
          const defaultFolders = data.defaultFolders?.items || [];
          isDefault = defaultFolders.some(folder => folder.id === currentCategory.dataset.id);
        } catch (error) {
          console.error('Error checking default folder status:', error);
        }
      }

      const menuItems = [
        {
          text: `${getLocalizedMessage('openAllBookmarks')} (${bookmarkCount})`,
          icon: 'open_in_new',
          action: () => {
            if (currentCategory) {
              const folderId = currentCategory.dataset.id;
              const folderTitle = currentCategory.dataset.title;

              // 递归获取所有书签 URL 的函数
              const getAllBookmarkUrls = async (folderId) => {
                return new Promise((resolve) => {
                  chrome.bookmarks.getChildren(folderId, async (items) => {
                    let urls = [];
                    for (const item of items) {
                      if (item.url) {
                        urls.push(item.url);
                      } else {
                        // 递归获取子文件夹的 URLs
                        const subUrls = await getAllBookmarkUrls(item.id);
                        urls = urls.concat(subUrls);
                      }
                    }
                    resolve(urls);
                  });
                });
              };

              // 获取并打开所有书签
              getAllBookmarkUrls(folderId).then(validUrls => {
                if (validUrls.length > 0) {
                  // 使用 background.js 中的优化函数
                  chrome.runtime.sendMessage({
                    action: 'openMultipleTabsAndGroup',
                    urls: validUrls,
                    groupName: folderTitle
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
        // 原有的菜单项保持不变
        { text: getLocalizedMessage('rename'), icon: 'edit' },
        { text: getLocalizedMessage('delete'), icon: 'delete' },
        { 
          text: isDefault ? getLocalizedMessage('removeFromDefaultFolders') : getLocalizedMessage('addToDefaultFolders'),
          icon: isDefault ? 'keep_off' : 'keep',
          action: async () => {
            if (!currentCategory?.dataset?.id) {
              console.error('No valid folder selected');
              return;
            }
            await toggleDefaultFolder(currentCategory);
          }
        }
      ];

      // 清空现有菜单项
      menu.innerHTML = '';

      // 创建菜单项的其余代码保持不变...
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

        menuItem.addEventListener('click', function () {
          if (item.action) {
            item.action();
          } else {
            switch (item.text) {
              case getLocalizedMessage('rename'):
                openEditCategoryDialog(currentCategory);
                break;
              case getLocalizedMessage('delete'):
                const categoryId = currentCategory.dataset.id;
                const categoryTitle = currentCategory.dataset.title;
                showConfirmDialog(chrome.i18n.getMessage("confirmDeleteFolder", [`<strong>${categoryTitle}</strong>`]), () => {
                  chrome.bookmarks.removeTree(categoryId, function () {
                    currentCategory.remove();
                    Utilities.showToast(getLocalizedMessage('categoryDeleted'));
                  });
                });
                break;
            }
          }
          menu.style.display = 'none';
        });

        menu.appendChild(menuItem);
      });
    };

    return {
      menu: menu,
      updateMenuItems: createMenuItems
    };
  }

  const categoryContextMenu = createCategoryContextMenu();

  document.addEventListener('contextmenu', function (event) {
    const targetCategory = event.target.closest('#categories-list li');
    if (targetCategory) {
      event.preventDefault();
      currentCategory = targetCategory;

      if (currentCategory) {
        const folderId = currentCategory.dataset.id;
        // 使用新的递归函数获取总书签数量
        getAllBookmarksCount(folderId).then(totalCount => {
          categoryContextMenu.updateMenuItems(totalCount);

          categoryContextMenu.menu.style.top = `${event.clientY}px`;
          categoryContextMenu.menu.style.left = `${event.clientX}px`;
          categoryContextMenu.menu.style.display = 'block';
        });
      }
    } else {
      categoryContextMenu.menu.style.display = 'none';
    }
  });

  document.addEventListener('click', function () {
    categoryContextMenu.menu.style.display = 'none';
  });

  const editCategoryDialog = document.getElementById('edit-category-dialog');
  const editCategoryForm = document.getElementById('edit-category-form');
  const editCategoryNameInput = document.getElementById('edit-category-name');
  const closeCategoryButton = document.querySelector('.close-category-button');
  const cancelCategoryButton = document.querySelector('.cancel-category-button');

  function openEditCategoryDialog(categoryElement) {
    const categoryId = categoryElement.dataset.id;
    const categoryTitle = categoryElement.dataset.title;

    editCategoryNameInput.value = categoryTitle;

    editCategoryDialog.style.display = 'block';

    editCategoryForm.onsubmit = function (event) {
      event.preventDefault();
      const updatedTitle = editCategoryNameInput.value;

      chrome.bookmarks.update(categoryId, {
        title: updatedTitle
      }, function (result) {
        updateCategoryUI(categoryElement, updatedTitle);
        editCategoryDialog.style.display = 'none';
      });
    };
  }

  function updateCategoryUI(categoryElement, newTitle) {
    // 更新侧边栏中的文件夹名称
    const sidebarItem = document.querySelector(`#categories-list li[data-id="${categoryElement.dataset.id}"]`);
    if (sidebarItem) {
      // 更新文本内容
      const textSpan = sidebarItem.querySelector('span:not(.material-icons)');
      if (textSpan) {
        textSpan.textContent = newTitle;
      }

      // 更新 data-title 属性
      sidebarItem.setAttribute('data-title', newTitle);

      // 更新样式
      sidebarItem.classList.add('updated-folder');
      setTimeout(() => {
        sidebarItem.classList.remove('updated-folder');
      }, 2000); // 2秒后移除高亮效果
    }

    // 更新面包屑导航
    updateFolderName(categoryElement.dataset.id);

    // 更新文件夹卡片（如果在当前视图中）
    const folderCard = document.querySelector(`.bookmark-folder[data-id="${categoryElement.dataset.id}"]`);
    if (folderCard) {
      const titleElement = folderCard.querySelector('.card-title');
      if (titleElement) {
        titleElement.textContent = newTitle;
      }
    }
  }

  closeCategoryButton.onclick = function () {
    editCategoryDialog.style.display = 'none';
  };

  cancelCategoryButton.onclick = function () {
    editCategoryDialog.style.display = 'none';
  };

  window.onclick = function (event) {
    if (event.target == editCategoryDialog) {
      editCategoryDialog.style.display = 'none';
    }
  };

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

        // 先隐藏容器
        bookmarksContainer.style.opacity = '0';
        bookmarksContainer.style.transform = 'translateY(20px)';

        // 更新缓存
        bookmarksCache.set(parentId, bookmarks);

        // 更新本地排序缓存
        bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

        // 清空现有书签
        bookmarksList.innerHTML = '';

        // 添加新的书签
        bookmarks.forEach((bookmark, index) => {
          const bookmarkElement = bookmark.url ? 
            createBookmarkCard(bookmark, index) : 
            createFolderCard(bookmark, index);
          bookmarksList.appendChild(bookmarkElement);
        });

        bookmarksList.dataset.parentId = parentId;

        // 更新文件夹名称
        updateFolderName(parentId);

        // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bookmarksContainer.style.opacity = '1';
            bookmarksContainer.style.transform = 'translateY(0)';
          });
        });

        resolve();
      });
    });
  }

Object.assign(S, { openEditCategoryDialog, updateCategoryUI, updateBookmarksDisplay });
