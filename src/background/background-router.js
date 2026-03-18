function handleBackgroundMessage(request, sender, sendResponse) {
  console.log('Received message in background:', request);

  const validation = BG_RULES.validateRequest(request, sender);
  if (!validation.ok) {
    sendResponse({ success: false, error: validation.error });
    return false;
  }

  switch (request.action) {
    case 'navigateHome':
      return handleNavigateHome(request, sender, sendResponse);

    case 'navigateBack':
    case 'navigateForward':
      return handleNavigateBackForward(request, sender, sendResponse);

    case 'getNavigationState':
      return handleGetNavigationState(request, sender, sendResponse);

    case 'recordAndNavigate':
      return handleRecordAndNavigate(request, sender, sendResponse);

    case 'openUrlInSidePanel':
      return handleOpenUrlInSidePanel(request, sender, sendResponse);

    case 'updateSidePanelHistory':
      return handleUpdateSidePanelHistory(request, sender, sendResponse);

    case 'fetchBookmarks':
      return handleFetchBookmarks(sendResponse);

    case 'getDefaultBookmarkId':
      return handleGetDefaultBookmarkId(sendResponse);

    case 'setDefaultBookmarkId':
      return handleSetDefaultBookmarkId(request, sendResponse);

    case 'openMultipleTabsAndGroup':
      handleOpenMultipleTabsAndGroup(request, sendResponse);
      return true;

    case 'updateFloatingBallSetting':
      return handleUpdateFloatingBallSetting(request, sendResponse);

    case 'openSidePanel':
      toggleSidePanel();
      sendResponse({ success: true });
      return true;

    case 'reloadExtension':
      return handleReloadExtension();

    case 'openInSidePanel':
      return handleOpenInSidePanel(request, sendResponse);

    case 'updateBookmarkDisplay':
      return handleUpdateBookmarkDisplay(request, sendResponse);

    case 'getBookmarkFolder':
      return handleGetBookmarkFolder(request, sendResponse);

    case 'checkSidePanelStatus':
      return handleCheckSidePanelStatus(sendResponse);

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
}

chrome.runtime.onMessage.addListener(handleBackgroundMessage);
