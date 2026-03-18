function handleFetchBookmarks(sendResponse) {
  chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }

    try {
      const folders = await new Promise((resolve) => {
        chrome.bookmarks.getTree((tree) => resolve(tree));
      });

      const processedBookmarks = [];
      function processBookmarkNode(node) {
        if (node.url) {
          processedBookmarks.push(node);
        }
        if (node.children) {
          node.children.forEach(processBookmarkNode);
        }
      }

      folders.forEach((folder) => processBookmarkNode(folder));

      sendResponse({
        bookmarks: bookmarkTreeNodes,
        processedBookmarks,
        success: true
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  });

  return true;
}

function handleGetDefaultBookmarkId(sendResponse) {
  if (defaultBookmarkId !== null) {
    sendResponse({ defaultBookmarkId });
    return false;
  }

  chrome.storage.local.get(['defaultBookmarkId'], (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    defaultBookmarkId = result.defaultBookmarkId ?? null;
    sendResponse({ defaultBookmarkId });
  });

  return true;
}

function handleSetDefaultBookmarkId(request, sendResponse) {
  defaultBookmarkId = request.defaultBookmarkId;
  chrome.storage.local.set({ defaultBookmarkId }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true });
    }
  });

  return true;
}

function handleUpdateFloatingBallSetting(request, sendResponse) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateFloatingBall',
          enabled: request.enabled
        });
      } catch (error) {
        console.error('Error sending message to tab:', error);
      }
    });
  });
  chrome.storage.sync.set({ enableFloatingBall: request.enabled });
  sendResponse({ success: true });
  return true;
}

function handleReloadExtension() {
  chrome.runtime.reload();
  return true;
}

function handleOpenInSidePanel(request, sendResponse) {
  createTab(request.url).then((tab) => {
    console.log('Successfully created new tab:', tab);
    sendResponse({ success: true, tabId: tab.id });
  }).catch((error) => {
    console.error('Failed to create tab:', error);
    sendResponse({ success: false, error: error.message || String(error) });
  });

  return true;
}

function handleUpdateBookmarkDisplay(request, sendResponse) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateBookmarkDisplay',
          folderId: request.folderId
        });
      } catch (error) {
        console.error('Error sending message to tab:', error);
      }
    });
  });
  sendResponse({ success: true });
  return true;
}

function handleGetBookmarkFolder(request, sendResponse) {
  chrome.bookmarks.get(request.folderId, (folder) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message
      });
      return;
    }

    if (!folder[0].url) {
      chrome.bookmarks.getChildren(request.folderId, (children) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: true,
            folder: folder[0],
            error: chrome.runtime.lastError.message
          });
        } else {
          sendResponse({
            success: true,
            folder: folder[0],
            children
          });
        }
      });
      return true;
    }

    sendResponse({
      success: true,
      folder: folder[0]
    });
  });

  return true;
}

function handleCheckSidePanelStatus(sendResponse) {
  sendResponse({ isOpen: sidePanelState.isOpen });
  return true;
}
