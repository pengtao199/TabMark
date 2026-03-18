let defaultBookmarkId = null;
let sidePanelState = { isOpen: false };
const NAVIGATION_HOME_PATH = BG_RULES.NAVIGATION_HOME_PATH;
const openingTabs = new Set();
const DEBOUNCE_TIME = BG_RULES.OPENING_TAB_DEBOUNCE_MS;

function hydrateRuntimeState() {
  chrome.storage.local.get(['defaultBookmarkId'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Failed to hydrate defaultBookmarkId:', chrome.runtime.lastError.message);
      return;
    }
    defaultBookmarkId = result.defaultBookmarkId ?? null;
  });

  if (chrome.storage && chrome.storage.session) {
    chrome.storage.session.get(['sidepanel_active'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to hydrate side panel state:', chrome.runtime.lastError.message);
        return;
      }
      sidePanelState.isOpen = result.sidepanel_active === true;
    });
  }
}

function persistSidePanelState(isOpen) {
  sidePanelState.isOpen = isOpen;
  if (chrome.storage && chrome.storage.session) {
    chrome.storage.session.set({ sidepanel_active: isOpen });
  }
}

function registerSidePanelNavigationScript() {
  console.log('Using static content script registration from manifest.json');
}

function createTab(url, options = {}) {
  return new Promise((resolve, reject) => {
    if (openingTabs.has(url)) {
      console.log('Preventing duplicate tab open for URL:', url);
      reject(new Error('Duplicate request'));
      return;
    }

    openingTabs.add(url);

    chrome.tabs.create({
      url,
      active: true,
      ...options
    }, (tab) => {
      if (chrome.runtime.lastError) {
        openingTabs.delete(url);
        reject(chrome.runtime.lastError);
      } else {
        resolve(tab);
      }

      setTimeout(() => {
        openingTabs.delete(url);
      }, DEBOUNCE_TIME);
    });
  });
}

function handleOpenMultipleTabsAndGroup(request, sendResponse) {
  const { urls, groupName } = request;
  const tabIds = [];

  const createTabPromises = urls.map((url) => new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!chrome.runtime.lastError) {
        tabIds.push(tab.id);
      }
      resolve();
    });
  }));

  Promise.all(createTabPromises).then(() => {
    if (tabIds.length > 1) {
      chrome.tabs.group({ tabIds }, (groupId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        if (chrome.tabGroups) {
          chrome.tabGroups.update(groupId, {
            title: groupName,
            color: 'cyan'
          }, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: true, warning: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        } else {
          sendResponse({ success: true, warning: 'tabGroups API 不可用，无法设置组名和颜色' });
        }
      });
    } else {
      sendResponse({ success: true, message: 'URL 数量不大于 1，直接打开标签页，不创建标签组' });
    }
  });
}

function toggleSidePanel() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error('No active tabs found');
      return;
    }

    const tabId = tabs[0].id;

    if (sidePanelState.isOpen) {
      chrome.sidePanel.setOptions({
        enabled: false
      });
      persistSidePanelState(false);
      console.log('Side panel closed');
      return;
    }

    chrome.sidePanel.setOptions({
      enabled: true,
      path: NAVIGATION_HOME_PATH
    });

    chrome.sidePanel.open({
      tabId
    }).then(() => {
      console.log('Side panel opened successfully');
      persistSidePanelState(true);

      chrome.storage.session.set({ sidepanel_active: true }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存侧边栏状态出错:', chrome.runtime.lastError);
        } else {
          console.log('侧边栏状态已保存到session storage');
        }
      });

      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'sidepanelNavigation',
            isSidePanel: true
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('侧边栏打开标记发送失败 (expected):', chrome.runtime.lastError.message);
            } else {
              console.log('侧边栏打开标记发送成功:', response);
            }
          });
        } catch (error) {
          console.error('发送侧边栏打开标记失败:', error);
        }
      }, 1000);
    }).catch((error) => {
      console.error('Failed to open side panel:', error);
    });
  });
}

function handleInstalled(details) {
  console.log('Extension installed or updated:', details.reason);

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: 'chrome://newtab' });
    chrome.storage.local.set({ defaultBookmarkId: null });
    defaultBookmarkId = null;
    chrome.storage.sync.set({
      openInNewTab: true,
      sidepanelOpenInNewTab: true,
      sidepanelOpenInSidepanel: false
    });
  }

  chrome.commands.getAll((commands) => {
    console.log('Registered commands:', commands);

    const sidePanelCommand = commands.find((cmd) => cmd.name === 'open_side_panel');
    if (sidePanelCommand) {
      console.log('Side panel command registered with shortcut:', sidePanelCommand.shortcut);
    } else {
      console.warn('Side panel command not found! Available commands:', commands.map((cmd) => cmd.name).join(', '));

      const alternativeCommand = commands.find((cmd) =>
        cmd.name === '_execute_action_with_ui' ||
        cmd.name.includes('side') ||
        cmd.name.includes('panel')
      );

      if (alternativeCommand) {
        console.log('Found alternative command that might be for side panel:', alternativeCommand);
      }
    }
  });

  registerSidePanelNavigationScript();
}

function handleCommand(command) {
  console.log(`Command received: ${command}`);

  if (command === 'open_side_panel') {
    console.log('Toggling side panel with shortcut');
    toggleSidePanel();
  }
}

function handleActionClicked() {
  console.log('Extension icon clicked');
  toggleSidePanel();
}

hydrateRuntimeState();
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.commands.onCommand.addListener(handleCommand);
chrome.action.onClicked.addListener(handleActionClicked);
