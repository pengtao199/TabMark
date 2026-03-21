import { createUtilities } from '../bookmark-actions.js';

const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
const getLocalizedMessage = (...args) => (
  typeof S.getLocalizedMessage === 'function' ? S.getLocalizedMessage(...args) : (args[0] || '')
);
const Utilities = createUtilities(getLocalizedMessage);

let categoriesSortable = null;
const categorySubfolderSortables = new WeakMap();
const mainPanelInteractables = [];
let moveInProgress = false;
const pointerCaptureByElement = new WeakMap();

const dragState = {
  draggedElement: null,
  draggedId: null,
  sourceParentId: null,
  currentParentId: null,
  pointerX: 0,
  pointerY: 0,
  grabOffsetX: 0,
  grabOffsetY: 0,
  hoverFolder: null,
  lockedFolder: null,
  hoverTimer: null,
  moved: false,
  placeholderElement: null,
  previewElement: null,
  startRect: null
};

const FOLDER_HOVER_LOCK_MS = 220;
const FOLDER_CENTER_RATIO = 0.72;
const DRAG_CLICK_SUPPRESS_MS = 250;
const ROW_GROUP_GAP = 28;

function getEventClientPoint(event) {
  if (!event) {
    return { x: null, y: null };
  }

  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return { x: event.clientX, y: event.clientY };
  }

  if (Number.isFinite(event.pageX) && Number.isFinite(event.pageY)) {
    return { x: event.pageX, y: event.pageY };
  }

  if (Number.isFinite(event.x0) && Number.isFinite(event.y0)) {
    return { x: event.x0, y: event.y0 };
  }

  if (Number.isFinite(event?.client?.x) && Number.isFinite(event?.client?.y)) {
    return { x: event.client.x, y: event.client.y };
  }

  if (Number.isFinite(event?.page?.x) && Number.isFinite(event?.page?.y)) {
    return { x: event.page.x, y: event.page.y };
  }

  if (Number.isFinite(event?.interaction?.coords?.cur?.client?.x) && Number.isFinite(event?.interaction?.coords?.cur?.client?.y)) {
    return {
      x: event.interaction.coords.cur.client.x,
      y: event.interaction.coords.cur.client.y
    };
  }

  if (Number.isFinite(event?.interaction?.coords?.start?.client?.x) && Number.isFinite(event?.interaction?.coords?.start?.client?.y)) {
    return {
      x: event.interaction.coords.start.client.x,
      y: event.interaction.coords.start.client.y
    };
  }

  return { x: null, y: null };
}

function getNativePointerPoint(event) {
  if (!event) {
    return null;
  }

  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = event.touches?.[0] || event.changedTouches?.[0] || null;
  if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    return { x: touch.clientX, y: touch.clientY };
  }

  return null;
}

function rememberPointerCapture(element, event) {
  const point = getNativePointerPoint(event);
  if (!element || !point) {
    return;
  }

  pointerCaptureByElement.set(element, point);
}

function getPointerCapture(element) {
  return element ? pointerCaptureByElement.get(element) || null : null;
}

function clearPointerCapture(element) {
  if (!element) {
    return;
  }

  pointerCaptureByElement.delete(element);
}

function clearHoverTimer() {
  if (!dragState.hoverTimer) {
    return;
  }

  clearTimeout(dragState.hoverTimer);
  dragState.hoverTimer = null;
}

function clearFolderHighlight(folder) {
  if (!folder) {
    return;
  }

  folder.classList.remove('is-drop-hover');
  folder.classList.remove('is-drop-target');
  folder.classList.remove('is-invalid-drop-target');
}

function applyFolderHighlight(folder, variant) {
  if (!folder) {
    return;
  }

  folder.classList.toggle('is-drop-hover', variant === 'hover');
  folder.classList.toggle('is-drop-target', variant === 'locked');
  folder.classList.toggle('is-invalid-drop-target', variant === 'invalid');
}

function resetDragState() {
  clearHoverTimer();
  clearFolderHighlight(dragState.hoverFolder);
  if (dragState.lockedFolder && dragState.lockedFolder !== dragState.hoverFolder) {
    clearFolderHighlight(dragState.lockedFolder);
  }
  document.body.classList.remove('is-bookmark-dragging');

  dragState.draggedElement = null;
  dragState.draggedId = null;
  dragState.sourceParentId = null;
  dragState.currentParentId = null;
  dragState.pointerX = 0;
  dragState.pointerY = 0;
  dragState.grabOffsetX = 0;
  dragState.grabOffsetY = 0;
  dragState.hoverFolder = null;
  dragState.lockedFolder = null;
  dragState.moved = false;
  dragState.placeholderElement = null;
  dragState.previewElement = null;
  dragState.startRect = null;
}

function getBookmarkNode(bookmarkId) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.get(bookmarkId, (results) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(results?.[0] || null);
    });
  });
}

function getBookmarkChildren(folderId) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getChildren(folderId, (children) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(children || []);
    });
  });
}

function getBookmarkSubTree(bookmarkId) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getSubTree(bookmarkId, (results) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(results?.[0] || null);
    });
  });
}

function subtreeContainsFolder(node, targetId) {
  if (!node?.children?.length) {
    return false;
  }

  return node.children.some((child) => (
    child.id === targetId || subtreeContainsFolder(child, targetId)
  ));
}

async function isInvalidFolderDrop(itemId, targetFolderId) {
  if (!itemId || !targetFolderId) {
    return false;
  }

  if (itemId === targetFolderId) {
    return true;
  }

  const itemNode = await getBookmarkNode(itemId);
  if (!itemNode || itemNode.url) {
    return false;
  }

  const subtree = await getBookmarkSubTree(itemId);
  return subtreeContainsFolder(subtree, targetFolderId);
}

async function getFolderInsertIndex(folderId) {
  const children = await getBookmarkChildren(folderId);
  return children.length;
}

async function refreshBookmarkViews(parentIds = [], refreshParentId = null, options = {}) {
  const {
    skipMainPanelRefresh = false,
    skipTreeRefresh = false
  } = options;
  if (typeof S.invalidateBookmarkCache === 'function') {
    S.invalidateBookmarkCache(parentIds);
  }

  if (!skipTreeRefresh && typeof S.refreshBookmarkTree === 'function') {
    await S.refreshBookmarkTree();
  }

  if (!skipMainPanelRefresh && refreshParentId && typeof S.updateBookmarksDisplay === 'function') {
    S.skipBookmarkRenderTransition = true;
    try {
      await S.updateBookmarksDisplay(refreshParentId);
      if (typeof S.updateFolderName === 'function') {
        S.updateFolderName(refreshParentId);
      }
      if (typeof S.selectSidebarFolder === 'function') {
        S.selectSidebarFolder(refreshParentId);
      }
    } finally {
      S.skipBookmarkRenderTransition = false;
    }
  }
}

function moveBookmark(itemId, newParentId, newIndex, options = {}) {
  const {
    sourceParentId = null,
    refreshParentId = null,
    skipMainPanelRefresh = false,
    skipTreeRefresh = false
  } = options;

  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(itemId, { parentId: newParentId, index: newIndex }, async (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      try {
        const affectedParents = [sourceParentId, newParentId, refreshParentId].filter(Boolean);
        await refreshBookmarkViews(
          affectedParents,
          refreshParentId,
          { skipMainPanelRefresh, skipTreeRefresh }
        );
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function updateDraggedTransform() {
  if (!dragState.previewElement) {
    return;
  }

  const previewLeft = dragState.pointerX - dragState.grabOffsetX;
  const previewTop = dragState.pointerY - dragState.grabOffsetY;
  dragState.previewElement.style.left = `${previewLeft}px`;
  dragState.previewElement.style.top = `${previewTop}px`;
  dragState.previewElement.style.transform = 'scale(1.02)';
}

function createDragPlaceholder(draggedElement) {
  const rect = draggedElement.getBoundingClientRect();
  const placeholder = document.createElement('div');
  placeholder.className = 'bookmark-drop-placeholder card';
  placeholder.style.width = `${rect.width}px`;
  placeholder.style.height = `${rect.height}px`;
  placeholder.dataset.dragPlaceholder = 'true';
  return placeholder;
}

function attachDraggedElementToBody(draggedElement) {
  const rect = draggedElement.getBoundingClientRect();
  draggedElement.classList.add('drag-preview');
  draggedElement.style.width = `${rect.width}px`;
  draggedElement.style.height = `${rect.height}px`;
  draggedElement.style.left = `${rect.left}px`;
  draggedElement.style.top = `${rect.top}px`;
  draggedElement.style.transform = 'scale(1.02)';
  document.body.appendChild(draggedElement);
  return draggedElement;
}

function restoreDraggedElementStyles(draggedElement) {
  if (!draggedElement) {
    return;
  }

  draggedElement.classList.remove('drag-preview');
  draggedElement.style.width = '';
  draggedElement.style.height = '';
  draggedElement.style.left = '';
  draggedElement.style.top = '';
  draggedElement.style.transform = '';
}

function getReorderableCards(bookmarksList) {
  return Array.from(bookmarksList.children).filter((element) => (
    (element.classList.contains('bookmark-card') || element.classList.contains('bookmark-folder') || element.dataset.dragPlaceholder === 'true')
      && !element.classList.contains('bookmark-create-card')
  ));
}

function isPointerInsideFolderCenter(folderElement) {
  if (!folderElement) {
    return false;
  }

  const rect = folderElement.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return false;
  }

  const innerWidth = rect.width * FOLDER_CENTER_RATIO;
  const innerHeight = rect.height * FOLDER_CENTER_RATIO;
  const minX = rect.left + ((rect.width - innerWidth) / 2);
  const maxX = rect.right - ((rect.width - innerWidth) / 2);
  const minY = rect.top + ((rect.height - innerHeight) / 2);
  const maxY = rect.bottom - ((rect.height - innerHeight) / 2);

  return (
    dragState.pointerX >= minX &&
    dragState.pointerX <= maxX &&
    dragState.pointerY >= minY &&
    dragState.pointerY <= maxY
  );
}

function getFolderUnderPointer() {
  if (!dragState.draggedElement) {
    return null;
  }

  const hovered = document.elementFromPoint(dragState.pointerX, dragState.pointerY);
  const folder = hovered?.closest?.('.bookmark-folder') || null;

  if (!folder || folder === dragState.draggedElement) {
    return null;
  }

  if (!isPointerInsideFolderCenter(folder)) {
    return null;
  }

  return folder;
}

function scheduleFolderLock(targetFolder) {
  if (!targetFolder?.dataset?.id) {
    return;
  }

  if (dragState.lockedFolder?.dataset?.id === targetFolder.dataset.id) {
    return;
  }

  if (dragState.hoverFolder?.dataset?.id === targetFolder.dataset.id) {
    return;
  }

  clearHoverTimer();
  clearFolderHighlight(dragState.hoverFolder);

  dragState.hoverFolder = targetFolder;
  applyFolderHighlight(targetFolder, 'hover');

  dragState.hoverTimer = setTimeout(async () => {
    if (dragState.hoverFolder !== targetFolder || !dragState.draggedId) {
      return;
    }

    const isInvalid = await isInvalidFolderDrop(dragState.draggedId, targetFolder.dataset.id);
    if (dragState.hoverFolder !== targetFolder) {
      return;
    }

    dragState.lockedFolder = targetFolder;
    applyFolderHighlight(targetFolder, isInvalid ? 'invalid' : 'locked');
  }, FOLDER_HOVER_LOCK_MS);
}

function releaseLockedFolderIfNeeded(currentTargetFolder) {
  const lockedFolder = dragState.lockedFolder;
  if (!lockedFolder) {
    return;
  }

  if (currentTargetFolder?.dataset?.id === lockedFolder.dataset.id && isPointerInsideFolderCenter(lockedFolder)) {
    return;
  }

  clearFolderHighlight(lockedFolder);
  dragState.lockedFolder = null;
}

function updateFolderTarget() {
  const targetFolder = getFolderUnderPointer();
  releaseLockedFolderIfNeeded(targetFolder);

  if (!targetFolder) {
    clearHoverTimer();
    clearFolderHighlight(dragState.hoverFolder);
    dragState.hoverFolder = null;
    return;
  }

  if (dragState.lockedFolder?.dataset?.id === targetFolder.dataset.id) {
    return;
  }

  if (dragState.hoverFolder?.dataset?.id && dragState.hoverFolder.dataset.id !== targetFolder.dataset.id) {
    clearHoverTimer();
    clearFolderHighlight(dragState.hoverFolder);
    dragState.hoverFolder = null;
  }

  scheduleFolderLock(targetFolder);
}

function groupItemsIntoRows(items) {
  const rows = [];

  items
    .sort((a, b) => {
      if (Math.abs(a.rect.top - b.rect.top) > 8) {
        return a.rect.top - b.rect.top;
      }
      return a.rect.left - b.rect.left;
    })
    .forEach((item) => {
      const lastRow = rows[rows.length - 1];
      if (!lastRow || Math.abs(lastRow.top - item.rect.top) > ROW_GROUP_GAP) {
        rows.push({
          top: item.rect.top,
          centerY: item.rect.top + (item.rect.height / 2),
          items: [item]
        });
        return;
      }

      lastRow.items.push(item);
      lastRow.centerY = lastRow.items.reduce((sum, entry) => sum + (entry.rect.top + (entry.rect.height / 2)), 0) / lastRow.items.length;
    });

  rows.forEach((row) => {
    row.items.sort((a, b) => a.rect.left - b.rect.left);
  });

  return rows;
}

function calculateReorderIndex(bookmarksList, draggedElement, pointerX, pointerY) {
  const items = getReorderableCards(bookmarksList)
    .filter((element) => element !== draggedElement && element.dataset.dragPlaceholder !== 'true');

  if (!items.length) {
    return 0;
  }

  const measuredItems = items.map((element) => ({
    element,
    rect: element.getBoundingClientRect()
  }));
  const rows = groupItemsIntoRows(measuredItems);

  let targetRow = rows[0];
  let rowDistance = Math.abs(pointerY - rows[0].centerY);
  rows.forEach((row) => {
    const distance = Math.abs(pointerY - row.centerY);
    if (distance < rowDistance) {
      rowDistance = distance;
      targetRow = row;
    }
  });

  let baseIndex = 0;
  for (const row of rows) {
    if (row === targetRow) {
      break;
    }
    baseIndex += row.items.length;
  }

  for (let i = 0; i < targetRow.items.length; i += 1) {
    const item = targetRow.items[i];
    const centerX = item.rect.left + (item.rect.width / 2);
    if (pointerX < centerX) {
      return baseIndex + i;
    }
  }

  return baseIndex + targetRow.items.length;
}

function updatePlaceholderPosition(bookmarksList) {
  const placeholder = dragState.placeholderElement;
  const draggedElement = dragState.draggedElement;
  if (!placeholder || !draggedElement) {
    return;
  }

  const reorderableCards = getReorderableCards(bookmarksList)
    .filter((element) => element !== placeholder);

  if (!reorderableCards.length) {
    bookmarksList.insertBefore(placeholder, bookmarksList.querySelector('.bookmark-create-card'));
    return;
  }

  const targetIndex = calculateReorderIndex(bookmarksList, draggedElement, dragState.pointerX, dragState.pointerY);
  const createCard = bookmarksList.querySelector('.bookmark-create-card');

  if (targetIndex >= reorderableCards.length) {
    bookmarksList.insertBefore(placeholder, createCard || null);
    return;
  }

  const referenceNode = reorderableCards[targetIndex];
  if (referenceNode && referenceNode !== placeholder) {
    bookmarksList.insertBefore(placeholder, referenceNode);
  }
}

function syncVisibleBookmarkIndexes(bookmarksList) {
  const cards = Array.from(bookmarksList.querySelectorAll('.bookmark-card, .bookmark-folder'))
    .filter((element) => !element.classList.contains('bookmark-create-card'));

  cards.forEach((card, index) => {
    card.dataset.index = index.toString();
  });
}

function commitPlaceholderPosition(bookmarksList, draggedElement) {
  const placeholder = dragState.placeholderElement;
  if (!placeholder || !draggedElement || !placeholder.parentNode) {
    return;
  }

  bookmarksList.insertBefore(draggedElement, placeholder);
}

async function handleMainPanelDrop(event, bookmarksList) {
  const draggedElement = dragState.draggedElement;
  const itemId = dragState.draggedId;
  const sourceParentId = dragState.sourceParentId || dragState.currentParentId || bookmarksList.dataset.parentId || '1';
  const currentParentId = dragState.currentParentId || bookmarksList.dataset.parentId || '1';
  const dropPoint = getEventClientPoint(event);
  const pointerX = dropPoint.x ?? dragState.pointerX;
  const pointerY = dropPoint.y ?? dragState.pointerY;
  const lockedFolder = (
    dragState.lockedFolder && isPointerInsideFolderCenter(dragState.lockedFolder)
      ? dragState.lockedFolder
      : null
  );

  if (!draggedElement || !itemId) {
    return;
  }

  if (moveInProgress) {
    return;
  }

  const reorderableCards = !lockedFolder ? getReorderableCards(bookmarksList) : [];
  const placeholderIndex = !lockedFolder
    ? reorderableCards.findIndex((element) => element.dataset.dragPlaceholder === 'true')
    : -1;
  const reorderIndex = !lockedFolder
    ? (placeholderIndex >= 0
      ? placeholderIndex
      : calculateReorderIndex(bookmarksList, draggedElement, pointerX, pointerY))
    : null;

  if (!lockedFolder) {
    commitPlaceholderPosition(bookmarksList, draggedElement);
  }

  dragState.placeholderElement?.remove();
  dragState.placeholderElement = null;
  if (draggedElement) {
    draggedElement.classList.remove('is-dragging-bookmark');
    restoreDraggedElementStyles(draggedElement);
  }
  dragState.previewElement = null;

  moveInProgress = true;
  try {
    if (lockedFolder?.dataset?.id) {
      const targetFolderId = lockedFolder.dataset.id;
      const invalidTarget = await isInvalidFolderDrop(itemId, targetFolderId);

      if (invalidTarget) {
        Utilities.showToast('不能将文件夹拖入自身或其子文件夹');
        await refreshBookmarkViews([currentParentId], null, currentParentId);
      } else {
        const targetIndex = await getFolderInsertIndex(targetFolderId);
        await moveBookmark(itemId, targetFolderId, targetIndex, {
          sourceParentId,
          refreshParentId: currentParentId
        });
      }
    } else {
      const safeReorderIndex = Number.isInteger(reorderIndex) ? reorderIndex : 0;
      const sourceIndex = Number.parseInt(draggedElement.dataset.index || '-1', 10);
      const adjustedReorderIndex = (
        sourceParentId === currentParentId &&
        Number.isInteger(sourceIndex) &&
        sourceIndex >= 0 &&
        safeReorderIndex > sourceIndex
      )
        ? safeReorderIndex + 1
        : safeReorderIndex;

      await moveBookmark(itemId, currentParentId, adjustedReorderIndex, {
        sourceParentId,
        refreshParentId: currentParentId,
        skipMainPanelRefresh: true,
        skipTreeRefresh: true
      });

      syncVisibleBookmarkIndexes(bookmarksList);
    }

  } catch (error) {
    console.error('Error handling bookmark panel drop:', error);
    await refreshBookmarkViews([sourceParentId, currentParentId], currentParentId);
  } finally {
    moveInProgress = false;
  }
}

function cleanupMainPanelInteractables() {
  while (mainPanelInteractables.length > 0) {
    const interactable = mainPanelInteractables.pop();
    interactable.unset();
  }
}

function registerFolderDropzone(folderElement, interactable) {
  interactable.dropzone({
    accept: '.bookmark-card, .bookmark-folder',
    overlap: 0.01,
    checker(_dragEvent, _nativeEvent, _dropped, _dropzone, dropElement, _draggable, draggableElement) {
      if (!draggableElement || !dropElement || draggableElement === dropElement) {
        return false;
      }
      return isPointerInsideFolderCenter(dropElement);
    },
    ondropactivate() {
      if (!dragState.draggedElement) {
        return;
      }
      scheduleFolderLock(folderElement);
    },
    ondragenter() {
      if (!dragState.draggedElement) {
        return;
      }
      scheduleFolderLock(folderElement);
    },
    ondragleave() {
      if (dragState.lockedFolder?.dataset?.id === folderElement.dataset.id) {
        return;
      }
      if (dragState.hoverFolder?.dataset?.id === folderElement.dataset.id) {
        clearHoverTimer();
        clearFolderHighlight(folderElement);
        dragState.hoverFolder = null;
      }
    }
  });
}

function registerCardDraggable(cardElement, bookmarksList) {
  cardElement.style.cursor = 'default';

  const rememberPressPoint = (event) => {
    rememberPointerCapture(cardElement, event);
  };

  cardElement.addEventListener('pointerdown', rememberPressPoint, true);
  cardElement.addEventListener('mousedown', rememberPressPoint, true);
  cardElement.addEventListener('touchstart', rememberPressPoint, { capture: true, passive: true });

  const interactable = interact(cardElement).draggable({
    cursorChecker() {
      return '';
    },
    listeners: {
      start(event) {
        const rect = event.target.getBoundingClientRect();
        const capturedPoint = getPointerCapture(event.target);
        const startPoint = capturedPoint || getEventClientPoint(event);
        dragState.draggedElement = event.target;
        dragState.draggedId = event.target.dataset.id || null;
        dragState.sourceParentId = event.target.dataset.parentId || bookmarksList.dataset.parentId || '1';
        dragState.currentParentId = bookmarksList.dataset.parentId || '1';
        dragState.pointerX = startPoint.x ?? rect.left + (rect.width / 2);
        dragState.pointerY = startPoint.y ?? rect.top + (rect.height / 2);
        dragState.grabOffsetX = dragState.pointerX - rect.left;
        dragState.grabOffsetY = dragState.pointerY - rect.top;
        dragState.moved = false;
        dragState.startRect = rect;
        dragState.placeholderElement = createDragPlaceholder(event.target);
        event.target.parentNode.insertBefore(dragState.placeholderElement, event.target);
        dragState.previewElement = attachDraggedElementToBody(event.target);
        document.body.classList.add('is-bookmark-dragging');
        updateDraggedTransform();
        event.target.classList.add('is-dragging-bookmark');
      },
      move(event) {
        if (!dragState.draggedElement) {
          return;
        }

        const movePoint = getEventClientPoint(event);
        dragState.pointerX = movePoint.x ?? dragState.pointerX;
        dragState.pointerY = movePoint.y ?? dragState.pointerY;
        const deltaX = dragState.pointerX - (dragState.startRect.left + dragState.grabOffsetX);
        const deltaY = dragState.pointerY - (dragState.startRect.top + dragState.grabOffsetY);
        if (!dragState.moved && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
          dragState.moved = true;
        }

        updateDraggedTransform();
        updateFolderTarget();
        if (!dragState.lockedFolder) {
          updatePlaceholderPosition(bookmarksList);
        }
      },
      async end(event) {
        const target = event.target;
        if (dragState.moved) {
          S.suppressBookmarkClicksUntil = Date.now() + DRAG_CLICK_SUPPRESS_MS;
        }
        await handleMainPanelDrop(event, bookmarksList);
        clearPointerCapture(target);
        resetDragState();
      }
    }
  });

  if (typeof interactable.styleCursor === 'function') {
    interactable.styleCursor(false);
  }

  if (cardElement.classList.contains('bookmark-folder')) {
    registerFolderDropzone(cardElement, interactable);
  }

  mainPanelInteractables.push(interactable);
}

function setupMainBookmarksInteractions(bookmarksList) {
  cleanupMainPanelInteractables();
  resetDragState();

  const cards = Array.from(bookmarksList.querySelectorAll('.bookmark-card, .bookmark-folder'));
  cards.forEach((card) => {
    registerCardDraggable(card, bookmarksList);
  });
}

function setupCategorySortable(container) {
  const existing = categorySubfolderSortables.get(container);
  if (existing) {
    existing.destroy();
  }

  const sortable = new Sortable(container, {
    group: 'nested',
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65,
    onEnd(evt) {
      const itemEl = evt.item;
      const bookmarkId = itemEl.dataset.id;
      const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

      if (!bookmarkId || (evt.oldIndex === evt.newIndex && evt.from === evt.to)) {
        return;
      }

      moveBookmark(bookmarkId, newParentId, evt.newIndex, {
        sourceParentId: itemEl.dataset.parentId || null,
        refreshParentId: document.getElementById('bookmarks-list')?.dataset?.parentId || '1'
      }).catch((error) => {
        console.error('Error moving category bookmark:', error);
      });
    }
  });

  categorySubfolderSortables.set(container, sortable);
}

function setupSortable() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (bookmarksList) {
    setupMainBookmarksInteractions(bookmarksList);
  } else {
    console.error('Bookmarks list element not found');
  }

  const categoriesList = document.getElementById('categories-list');
  if (!categoriesList) {
    console.error('Categories list element not found');
    return;
  }

  if (categoriesSortable) {
    categoriesSortable.destroy();
  }

  categoriesSortable = new Sortable(categoriesList, {
    animation: 150,
    group: 'nested',
    fallbackOnBody: true,
    swapThreshold: 0.65,
    onEnd(evt) {
      const itemEl = evt.item;
      const bookmarkId = itemEl.dataset.id;
      const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

      if (!bookmarkId || (evt.oldIndex === evt.newIndex && evt.from === evt.to)) {
        return;
      }

      moveBookmark(bookmarkId, newParentId, evt.newIndex, {
        sourceParentId: itemEl.dataset.parentId || null,
        refreshParentId: document.getElementById('bookmarks-list')?.dataset?.parentId || '1'
      }).catch((error) => {
        console.error('Error moving root category bookmark:', error);
      });
    }
  });

  const folders = categoriesList.querySelectorAll('li ul');
  folders.forEach((folder) => {
    setupCategorySortable(folder);
  });
}

Object.assign(S, { setupSortable, moveBookmark });
