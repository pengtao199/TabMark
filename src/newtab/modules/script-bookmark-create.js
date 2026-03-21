import { createUtilities } from '../bookmark-actions.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const getLocalizedMessage = (...args) => (
  typeof S.getLocalizedMessage === 'function' ? S.getLocalizedMessage(...args) : (args[0] || '')
);
const Utilities = createUtilities(getLocalizedMessage);

let currentCreateMode = 'bookmark';
let createSubmissionInFlight = false;

function getCreateDialogElements() {
  return {
    dialog: document.getElementById('create-bookmark-dialog'),
    form: document.getElementById('create-bookmark-form'),
    titleInput: document.getElementById('create-bookmark-title'),
    urlInput: document.getElementById('create-bookmark-url'),
    urlField: document.querySelector('[data-create-field="url"]'),
    titleLabel: document.getElementById('create-bookmark-title-label'),
    submitButton: document.getElementById('create-bookmark-submit'),
    dialogTitle: document.getElementById('create-bookmark-dialog-title'),
    modeButtons: Array.from(document.querySelectorAll('.create-bookmark-mode-button'))
  };
}

function getCurrentParentId() {
  return document.getElementById('bookmarks-list')?.dataset?.parentId || '1';
}

function updateCreateDialogCopy(mode) {
  const { titleInput, urlInput, urlField, titleLabel, submitButton, dialogTitle, modeButtons } = getCreateDialogElements();
  const isFolderMode = mode === 'folder';

  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.createMode === mode);
  });

  if (dialogTitle) {
    dialogTitle.textContent = isFolderMode ? '新增文件夹' : '新增书签';
  }
  if (titleLabel) {
    titleLabel.textContent = isFolderMode ? '文件夹名称' : '书签名称';
  }
  if (submitButton) {
    submitButton.textContent = isFolderMode ? '创建文件夹' : '创建书签';
  }
  if (urlField) {
    urlField.style.display = isFolderMode ? 'none' : 'block';
  }
  if (urlInput) {
    urlInput.required = !isFolderMode;
    if (isFolderMode) {
      urlInput.value = '';
    }
  }
  if (titleInput) {
    titleInput.placeholder = isFolderMode ? '请输入文件夹名称' : '请输入书签名称';
  }
}

function setCreateMode(mode) {
  currentCreateMode = mode === 'folder' ? 'folder' : 'bookmark';
  updateCreateDialogCopy(currentCreateMode);
}

function resetCreateBookmarkForm() {
  const { form } = getCreateDialogElements();
  if (form) {
    form.reset();
  }
  createSubmissionInFlight = false;
  setCreateMode(currentCreateMode);
}

function closeCreateBookmarkDialog() {
  const { dialog, submitButton } = getCreateDialogElements();
  if (!dialog) {
    return;
  }

  dialog.style.display = 'none';
  if (submitButton) {
    submitButton.disabled = false;
  }
  resetCreateBookmarkForm();
}

function openCreateBookmarkDialog(mode = 'bookmark') {
  const { dialog, titleInput, submitButton } = getCreateDialogElements();
  if (!dialog) {
    return;
  }

  currentCreateMode = mode === 'folder' ? 'folder' : 'bookmark';
  resetCreateBookmarkForm();
  dialog.style.display = 'block';
  if (submitButton) {
    submitButton.disabled = false;
  }
  window.requestAnimationFrame(() => {
    titleInput?.focus();
  });
}

function isValidBookmarkUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return Boolean(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
}

async function refreshAfterCreate(parentId) {
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
  if (typeof S.selectSidebarFolder === 'function') {
    S.selectSidebarFolder(parentId);
  }
}

async function handleCreateBookmarkSubmit(event) {
  event.preventDefault();
  if (createSubmissionInFlight) {
    return;
  }

  const { titleInput, urlInput, submitButton } = getCreateDialogElements();
  const title = titleInput?.value?.trim() || '';
  const url = urlInput?.value?.trim() || '';
  const parentId = getCurrentParentId();

  if (!title) {
    Utilities.showToast('请输入名称');
    titleInput?.focus();
    return;
  }

  if (currentCreateMode === 'bookmark' && !isValidBookmarkUrl(url)) {
    Utilities.showToast('请输入有效链接');
    urlInput?.focus();
    return;
  }

  createSubmissionInFlight = true;
  if (submitButton) {
    submitButton.disabled = true;
  }

  const payload = currentCreateMode === 'folder'
    ? { parentId, title }
    : { parentId, title, url };

  chrome.bookmarks.create(payload, async (createdNode) => {
    if (chrome.runtime.lastError || !createdNode) {
      console.error('Error creating bookmark item:', chrome.runtime.lastError);
      Utilities.showToast(currentCreateMode === 'folder' ? '创建文件夹失败' : '创建书签失败');
      createSubmissionInFlight = false;
      if (submitButton) {
        submitButton.disabled = false;
      }
      return;
    }

    try {
      await refreshAfterCreate(parentId);
      closeCreateBookmarkDialog();
      Utilities.showToast(currentCreateMode === 'folder' ? '文件夹已创建' : '书签已创建');
    } catch (error) {
      console.error('Error refreshing bookmark view after create:', error);
      Utilities.showToast('创建成功，但刷新失败');
      closeCreateBookmarkDialog();
    } finally {
      createSubmissionInFlight = false;
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

function initCreateBookmarkDialog() {
  const {
    dialog,
    form,
    modeButtons
  } = getCreateDialogElements();

  if (!dialog || !form) {
    return;
  }

  const closeTargets = dialog.querySelectorAll('[data-create-close="true"]');
  closeTargets.forEach((target) => {
    target.addEventListener('click', closeCreateBookmarkDialog);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeCreateBookmarkDialog();
    }
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setCreateMode(button.dataset.createMode);
    });
  });

  form.addEventListener('submit', handleCreateBookmarkSubmit);
  setCreateMode('bookmark');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCreateBookmarkDialog, { once: true });
} else {
  initCreateBookmarkDialog();
}

assignToScriptState({
  openCreateBookmarkDialog,
  closeCreateBookmarkDialog,
  setCreateMode
});
