function getSidePanelHistory(callback) {
  chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
    callback(result.sidePanelHistory, result.sidePanelCurrentIndex);
  });
}

function saveSidePanelHistory(history, currentIndex, callback) {
  chrome.storage.local.set({
    sidePanelHistory: history,
    sidePanelCurrentIndex: currentIndex
  }, callback);
}

function sendNavigationState(sender, state) {
  if (!sender || !sender.tab || !sender.tab.id) {
    return;
  }

  try {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: 'updateNavigationState',
      ...state
    });
  } catch (error) {
    console.error('Error sending message to tab:', error);
  }
}

function handleNavigateHome(request, sender, sendResponse) {
  const homePath = NAVIGATION_HOME_PATH;

  chrome.sidePanel.setOptions({ path: homePath }).then(() => {

    getSidePanelHistory((historyValue, currentIndexValue) => {
      let history = historyValue || [];
      let currentIndex = currentIndexValue ?? -1;

      if (history.length === 0) {
        history = [homePath];
        currentIndex = 0;
      } else {
        if (currentIndex < history.length - 1) {
          history = history.slice(0, currentIndex + 1);
        }

        if (history[history.length - 1] !== homePath) {
          currentIndex++;
          history.push(homePath);
        } else {
        }
      }

      saveSidePanelHistory(history, currentIndex, () => {

        sendNavigationState(sender, {
          canGoBack: currentIndex > 0,
          canGoForward: currentIndex < history.length - 1,
          url: homePath,
          historyLength: history.length,
          currentIndex
        });

        sendResponse({
          success: true,
          canGoBack: currentIndex > 0,
          canGoForward: currentIndex < history.length - 1
        });
      });
    });
  }).catch((error) => {
    console.error('Error navigating to sidepanel home:', error);
    sendResponse({ success: false, error: error.message });
  });

  return true;
}

function handleNavigateBackForward(request, sender, sendResponse) {
  getSidePanelHistory((historyValue, currentIndexValue) => {
    if (!historyValue || currentIndexValue === undefined) {
      console.error('No history state found for navigation');
      sendResponse({ success: false, error: 'No history state found' });
      return;
    }

    const history = historyValue;
    let currentIndex = currentIndexValue;

    if (request.action === 'navigateBack' && currentIndex > 0) {
      currentIndex--;
    } else if (request.action === 'navigateForward' && currentIndex < history.length - 1) {
      currentIndex++;
    } else {
      sendResponse({
        success: false,
        error: 'Cannot navigate in requested direction',
        canGoBack: currentIndex > 0,
        canGoForward: currentIndex < history.length - 1,
        currentIndex,
        historyLength: history.length
      });
      return;
    }

    const targetUrl = history[currentIndex];

    chrome.storage.local.set({ sidePanelCurrentIndex: currentIndex }, () => {
      chrome.sidePanel.setOptions({ path: targetUrl }).then(() => {

        sendNavigationState(sender, {
          canGoBack: currentIndex > 0,
          canGoForward: currentIndex < history.length - 1,
          url: targetUrl,
          historyLength: history.length,
          currentIndex
        });

        sendResponse({
          success: true,
          currentIndex,
          canGoBack: currentIndex > 0,
          canGoForward: currentIndex < history.length - 1,
          url: targetUrl,
          historyLength: history.length
        });
      }).catch((error) => {
        console.error('Error navigating:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
  });

  return true;
}

function handleGetNavigationState(request, sender, sendResponse) {
  getSidePanelHistory((historyValue, currentIndexValue) => {
    if (!historyValue || currentIndexValue === undefined) {
      const initialHistory = [NAVIGATION_HOME_PATH];
      const initialIndex = 0;

      chrome.storage.local.set({
        sidePanelHistory: initialHistory,
        sidePanelCurrentIndex: initialIndex
      }, () => {
        sendResponse({
          success: true,
          canGoBack: false,
          canGoForward: false,
          initialized: true,
          historyLength: 1,
          currentIndex: 0
        });
      });
      return;
    }

    const history = historyValue;
    const currentIndex = currentIndexValue;
    const url = request.url || (history[currentIndex] || '');
    const canGoBack = currentIndex > 0;
    const canGoForward = currentIndex < history.length - 1;

    sendNavigationState(sender, {
      canGoBack,
      canGoForward,
      url,
      historyLength: history.length,
      currentIndex
    });

    sendResponse({
      success: true,
      currentIndex,
      canGoBack,
      canGoForward,
      url,
      historyLength: history.length
    });
  });

  return true;
}

function handleRecordAndNavigate(request, sender, sendResponse) {
  const url = request.url;

  getSidePanelHistory((historyValue, currentIndexValue) => {
    let history = historyValue || [];
    let currentIndex = currentIndexValue ?? -1;

    if (history.length === 0) {
      history.push(NAVIGATION_HOME_PATH);
      currentIndex = 0;
    }

    if (currentIndex < history.length - 1) {
      currentIndex++;
      history = history.slice(0, currentIndex);
    } else {
      currentIndex++;
    }

    history.push(url);

    saveSidePanelHistory(history, currentIndex, () => {
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (verifyResult) => {

        chrome.sidePanel.setOptions({ path: url }).then(() => {

          sendNavigationState(sender, {
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1,
            url,
            historyLength: history.length,
            currentIndex
          });

          sendResponse({
            success: true,
            currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1,
            historyLength: history.length
          });
        }).catch((error) => {
          console.error('Error navigating to intercepted link:', error);
          sendResponse({ success: false, error: error.message });
        });
      });
    });
  });

  return true;
}

function navigateToUrl(url, sender, sendResponse, isNavigating = false) {

  if (!isNavigating) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'sidepanelNavigation',
            isSidePanel: true,
            url,
            phase: 'before_navigation'
          }, (response) => {
            if (chrome.runtime.lastError) {
            } else {
            }
          });
        } catch (error) {
          console.error('发送侧边栏预加载标记失败:', error);
        }
      }
    });
  }

  if (!url.includes('sidepanel.html') && !url.includes('sidepanel_view=')) {
    url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
  }

  chrome.storage.session.set({
    sidepanel_view: true,
    sidepanel_last_url: url,
    sidepanel_timestamp: Date.now()
  }, () => {
  });

  chrome.sidePanel.setOptions({ path: url }).then(() => {

    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      if (result.sidePanelHistory && result.sidePanelCurrentIndex !== undefined) {
        const history = result.sidePanelHistory;
        const currentIndex = result.sidePanelCurrentIndex;

        if (sender && sender.tab && sender.tab.id) {
          try {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'updateNavigationState',
              canGoBack: currentIndex > 0,
              canGoForward: currentIndex < history.length - 1
            }, (response) => {
              if (chrome.runtime.lastError) {
              }
            });
          } catch (error) {
            console.error('Error sending navigation update:', error);
          }
        }

        setTimeout(() => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
              try {
                for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'sidepanelNavigation',
                      isSidePanel: true,
                      url,
                      phase: 'after_navigation',
                      attempt: i + 1
                    }, (response) => {
                      if (chrome.runtime.lastError) {
                      } else {
                      }
                    });
                  }, i * 1000);
                }
              } catch (error) {
                console.error('发送侧边栏标记失败:', error);
              }
            }
          });
        }, 1500);
      }

      if (sendResponse) {
        sendResponse({ success: true });
      }
    });
  }).catch((error) => {
    console.error('Error opening URL in side panel:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.toString() });
    }
  });
}

function handleOpenUrlInSidePanel(request, sender, sendResponse) {
  const url = request.url;

  if (request.updateHistory !== false) {
    getSidePanelHistory((historyValue, currentIndexValue) => {
      let history = historyValue || [];
      let currentIndex = currentIndexValue ?? -1;

      if (history.length === 0) {
        history.push(NAVIGATION_HOME_PATH);
        currentIndex = 0;
      }

      if (currentIndex < history.length - 1) {
        currentIndex++;
        history = history.slice(0, currentIndex);
      } else {
        currentIndex++;
      }

      history.push(url);

      saveSidePanelHistory(history, currentIndex, () => {
        chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (verifyResult) => {

          navigateToUrl(url, sender, sendResponse, request.isNavigating);
        });
      });
    });
  } else {
    navigateToUrl(url, sender, sendResponse, request.isNavigating);
  }

  return true;
}

function handleUpdateSidePanelHistory(request, sender, sendResponse) {

  getSidePanelHistory((historyValue, currentIndexValue) => {
    let history = historyValue || [];
    let currentIndex = currentIndexValue ?? -1;

    if (history.length === 0) {
      history.push(NAVIGATION_HOME_PATH);
      currentIndex = 0;
    }

    if (currentIndex < history.length - 1) {
      currentIndex++;
      history = history.slice(0, currentIndex);
    } else {
      currentIndex++;
    }

    history.push(request.url);

    const canGoBack = currentIndex > 0;
    const canGoForward = currentIndex < history.length - 1;

    saveSidePanelHistory(history, currentIndex, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: 'updateNavigationState',
              canGoBack,
              canGoForward,
              url: request.url,
              historyLength: history.length,
              currentIndex
            },
            (response) => {
              if (chrome.runtime.lastError) {
              } else if (response) {
              }
            }
          );
        }
      });

      if (sendResponse) {
        sendResponse({
          success: true,
          canGoBack,
          canGoForward
        });
      }
    });
  });

  return true;
}
