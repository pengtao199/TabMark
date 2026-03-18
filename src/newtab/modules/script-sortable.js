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
let bookmarkOrderCache = {};
function setupSortable() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (bookmarksList) {
    new Sortable(bookmarksList, {
      animation: 150,
      onEnd: function (evt) {
        const itemId = evt.item.dataset.id;
        const newParentId = bookmarksList.dataset.parentId;
        const newIndex = evt.newIndex;

        showMovingFeedback(evt.item);

        moveBookmark(itemId, newParentId, newIndex)
          .then(() => {
            hideMovingFeedback(evt.item);
            showSuccessFeedback(evt.item);
          })
          .catch(error => {
            console.error('Error moving bookmark:', error);
            hideMovingFeedback(evt.item);
            showErrorFeedback(evt.item);
            syncBookmarkOrder(newParentId);
          });
      }
    });
  } else {
    console.error('Bookmarks list element not found');
  }

  const categoriesList = document.getElementById('categories-list');
  if (categoriesList) {
    new Sortable(categoriesList, {
      animation: 150,
      group: 'nested',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onStart: function (evt) {
        console.log('Category drag started:', evt.item.dataset.id);
      },
      onEnd: function (evt) {
        const itemEl = evt.item;
        const newIndex = evt.newIndex;
        const bookmarkId = itemEl.dataset.id;
        const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

        console.log('Category moved:', {
          bookmarkId: bookmarkId,
          newParentId: newParentId,
          oldIndex: evt.oldIndex,
          newIndex: newIndex,
          fromList: evt.from.id,
          toList: evt.to.id
        });

        if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
          moveBookmark(bookmarkId, newParentId, newIndex);
        }
      }
    });

    const folders = categoriesList.querySelectorAll('li ul');
    folders.forEach((folder, index) => {
      new Sortable(folder, {
        group: 'nested',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onStart: function (evt) {
          console.log('Subfolder drag started:', evt.item.dataset.id);
        },
        onEnd: function (evt) {
          const itemEl = evt.item;
          const newIndex = evt.newIndex;
          const bookmarkId = itemEl.dataset.id;
          const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

          console.log('Subfolder item moved:', {
            bookmarkId: bookmarkId,
            newParentId: newParentId,
            oldIndex: evt.oldIndex,
            newIndex: newIndex,
            fromList: evt.from.id,
            toList: evt.to.id
          });

          if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
            moveBookmark(bookmarkId, newParentId, newIndex);
          }
        }
      });
    });
  } else {
    console.error('Categories list element not found');
  }
}

function moveBookmark(itemId, newParentId, newIndex) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(itemId, { index: newIndex }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error moving bookmark:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log(`Bookmark ${itemId} moved to index ${result.index}`);
        updateAffectedBookmarks(newParentId, itemId, result.index)
          .then(() => {
            console.log(`Bookmark ${itemId} position updated in UI`);
            resolve(result);
          })
          .catch(reject);
      }
    });
  });
}

function updateAffectedBookmarks(parentId, movedItemId, newIndex) {
  return new Promise((resolve, reject) => {
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarkElements = Array.from(bookmarksList.children);
    const movedElement = bookmarksList.querySelector(`[data-id="${movedItemId}"]`);
    
    if (!movedElement) {
      console.error('Moved element not found');
      reject(new Error('Moved element not found'));
      return;
    }

    const oldIndex = bookmarkElements.indexOf(movedElement);
    
    // 如置没有变化，不需要更新
    if (oldIndex === newIndex) {
      resolve();
      return;
    }

    // 移动元素到新位置
    if (newIndex >= bookmarkElements.length) {
      bookmarksList.appendChild(movedElement);
    } else {
      bookmarksList.insertBefore(movedElement, bookmarksList.children[newIndex]);
    }

    // 更新所有书签的索引
    bookmarkElements.forEach((element, index) => {
      element.dataset.index = index.toString();
    });

    // 更新本地缓存
    bookmarkOrderCache[parentId] = bookmarkElements.map(el => el.dataset.id);

    highlightBookmark(movedItemId);
    console.log(`UI updated: Bookmark ${movedItemId} moved from ${oldIndex} to ${newIndex}`);
    resolve();
  });
}

function highlightBookmark(itemId) {
  const bookmarkElement = document.querySelector(`[data-id="${itemId}"]`);
  if (bookmarkElement) {
    bookmarkElement.style.transition = 'background-color 0.5s ease';
    bookmarkElement.style.backgroundColor = '#ffff99';
    setTimeout(() => {
      bookmarkElement.style.backgroundColor = '';
    }, 1000);
  }
}

Object.assign(S, { setupSortable, moveBookmark, updateAffectedBookmarks, highlightBookmark });
