import { featureTips } from './feature-tips.js';

// 书签清理插件相关常量
const CLEANUP_EXTENSION = {
  ID: 'aeehapalakdoclgmfeondmephgiandef',
  STORE_URL: 'https://chromewebstore.google.com/detail/lazycat-bookmark-cleaner/aeehapalakdoclgmfeondmephgiandef'
};

// 检查插件是否已安装
function requestManagementPermission() {
  return new Promise((resolve) => {
    if (!chrome.permissions || !chrome.permissions.request) {
      resolve(false);
      return;
    }

    chrome.permissions.request({ permissions: ['management'] }, (granted) => {
      resolve(Boolean(granted));
    });
  });
}

function checkExtensionInstalled() {
  return new Promise((resolve) => {
    if (!chrome.management || !chrome.management.get) {
      resolve(false);
      return;
    }

    chrome.management.get(CLEANUP_EXTENSION.ID, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// 添加从设置中打开清理工具的处理函数
function initBookmarkCleanupSettings() {
  const openCleanupButton = document.getElementById('open-bookmark-cleanup');
  if (openCleanupButton) {
    openCleanupButton.addEventListener('click', async () => {
      const hasPermission = await requestManagementPermission();
      const isInstalled = hasPermission ? await checkExtensionInstalled() : false;

      if (isInstalled) {
        window.open(`chrome-extension://${CLEANUP_EXTENSION.ID}/index.html`, '_blank');
      } else {
        const confirmInstall = confirm(chrome.i18n.getMessage('bookmarkCleanupNotInstalled'));
        if (confirmInstall) {
          window.open(CLEANUP_EXTENSION.STORE_URL, '_blank');
        }
      }
    });
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initBookmarkCleanupSettings();
});

export {}; 
