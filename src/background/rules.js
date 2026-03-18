(function initBackgroundRules(globalScope) {
  const NAVIGATION_HOME_PATH = 'src/sidepanel.html';
  const OPENING_TAB_DEBOUNCE_MS = 1000;
  const MAX_BATCH_TABS = 50;
  const ACTION_ALLOWLIST = new Set([
    'navigateHome',
    'navigateBack',
    'navigateForward',
    'getNavigationState',
    'recordAndNavigate',
    'openUrlInSidePanel',
    'fetchBookmarks',
    'getDefaultBookmarkId',
    'setDefaultBookmarkId',
    'openMultipleTabsAndGroup',
    'updateFloatingBallSetting',
    'openSidePanel',
    'updateSidePanelHistory',
    'reloadExtension',
    'openInSidePanel',
    'updateBookmarkDisplay',
    'getBookmarkFolder',
    'checkSidePanelStatus'
  ]);

  function isSafeNavigationTarget(value) {
    if (typeof value !== 'string') return false;
    const target = value.trim();
    if (!target) return false;
    if (target.startsWith('src/')) return true;
    if (target.startsWith('chrome-extension://')) return true;

    try {
      const url = new URL(target);
      return ['http:', 'https:', 'chrome:', 'edge:'].includes(url.protocol);
    } catch (error) {
      return false;
    }
  }

  function isSafeWebUrl(value) {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol);
    } catch (error) {
      return false;
    }
  }

  function isTrustedSender(sender) {
    if (!sender || !sender.id) return true;
    return sender.id === chrome.runtime.id;
  }

  function validateRequest(request, sender) {
    if (!isTrustedSender(sender)) {
      return { ok: false, error: 'Untrusted sender' };
    }

    if (!request || typeof request.action !== 'string' || request.action.length === 0) {
      return { ok: false, error: 'Invalid action' };
    }

    if (!ACTION_ALLOWLIST.has(request.action)) {
      return { ok: false, error: 'Action not allowed' };
    }

    switch (request.action) {
      case 'openUrlInSidePanel':
      case 'recordAndNavigate':
      case 'updateSidePanelHistory':
      case 'openInSidePanel':
        if (!isSafeNavigationTarget(request.url)) {
          return { ok: false, error: 'Invalid URL' };
        }
        break;
      case 'openMultipleTabsAndGroup':
        if (!Array.isArray(request.urls) || request.urls.length === 0 || request.urls.length > MAX_BATCH_TABS) {
          return { ok: false, error: 'Invalid URL list' };
        }
        if (!request.urls.every((url) => isSafeWebUrl(url))) {
          return { ok: false, error: 'Unsupported URL protocol' };
        }
        break;
      case 'setDefaultBookmarkId':
        if (!(typeof request.defaultBookmarkId === 'string' || request.defaultBookmarkId === null)) {
          return { ok: false, error: 'Invalid bookmark id' };
        }
        break;
      case 'getBookmarkFolder':
        if (typeof request.folderId !== 'string' || request.folderId.trim().length === 0) {
          return { ok: false, error: 'Invalid folder id' };
        }
        break;
      default:
        break;
    }

    return { ok: true };
  }

  globalScope.BG_RULES = {
    NAVIGATION_HOME_PATH,
    OPENING_TAB_DEBOUNCE_MS,
    validateRequest
  };
})(self);
