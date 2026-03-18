(async function () {
  if (window.top !== window.self) {
    return;
  }

  const bootstrap = async () => {
    try {
      const [helpersModule, uiModule, autoInputModule] = await Promise.all([
        import(chrome.runtime.getURL('src/content/content-helpers.mjs')),
        import(chrome.runtime.getURL('src/content/content-ui.mjs')),
        import(chrome.runtime.getURL('src/content/auto-input-manager.mjs')),
      ]);

      const {
        getSelectedText,
        getSearchQuery,
        displayBookmarks,
        getCurrentSearchEngine,
      } = helpersModule;

      const {
        createFloatingButtonMarkup,
        createSearchSwitcherMarkup,
        getContentStyles,
        getNonSelectableStyles,
      } = uiModule;

      const { AutoInputManager, siteConfigs } = autoInputModule;

      const extensionContainer = document.createElement('div');
      document.body.appendChild(extensionContainer);

      const shadow = extensionContainer.attachShadow({ mode: 'open' });

      const floatingButton = document.createElement('div');
      floatingButton.id = 'floating-button';
      floatingButton.innerHTML = createFloatingButtonMarkup({
        iconUrl: chrome.runtime.getURL('../images/icon-48.png'),
        clickTip: chrome.i18n.getMessage('floatingBallClickTip'),
        clickDesc: chrome.i18n.getMessage('floatingBallClickDesc'),
        altClickTip: chrome.i18n.getMessage('floatingBallAltClickTip'),
        altClickDesc: chrome.i18n.getMessage('floatingBallAltClickDesc'),
        shortcutTip: chrome.i18n.getMessage('floatingBallShortcutTip'),
        shortcutDesc: chrome.i18n.getMessage('floatingBallShortcutDesc'),
        closeTitle: chrome.i18n.getMessage('doNotShowAgain'),
      });

      const sidebarContainer = document.createElement('div');
      sidebarContainer.id = 'sidebar-container';
      sidebarContainer.classList.add('collapsed');

      shadow.appendChild(floatingButton);
      shadow.appendChild(sidebarContainer);

      const closeButton = floatingButton.querySelector('.tooltip-close');
      closeButton?.addEventListener('click', (event) => {
        event.stopPropagation();
        chrome.storage.local.set({ hideFloatingTooltip: true }, () => {
          const tooltip = floatingButton.querySelector('.floating-tooltip');
          if (tooltip) {
            tooltip.style.display = 'none';
          }
        });
      });

      chrome.storage.local.get(['hideFloatingTooltip'], (result) => {
        if (result.hideFloatingTooltip) {
          const tooltip = floatingButton.querySelector('.floating-tooltip');
          if (tooltip) {
            tooltip.style.display = 'none';
          }
        }
      });

      const defaultSearchEngine = getCurrentSearchEngine();
      const searchSwitcher = document.createElement('aside');
      searchSwitcher.id = 'search-switcher';
      searchSwitcher.innerHTML = createSearchSwitcherMarkup({
        defaultSearchEngine,
        runtime: chrome.runtime,
      });
      sidebarContainer.appendChild(searchSwitcher);

      let cachedSelectedText = '';
      let isFloatingBallEnabled = true;

      function getSearchText() {
        return (
          cachedSelectedText ||
          getSearchQuery() ||
          getSelectedText({ extensionContainer, shadow }) ||
          ''
        );
      }

      function openSearch(item) {
        if (!item) {
          return;
        }

        const searchText = getSearchText();
        const baseUrl = item.getAttribute('data-url');
        if (baseUrl) {
          const searchUrl = baseUrl + encodeURIComponent(searchText.trim());
          window.open(searchUrl, '_blank');

          searchSwitcher.querySelectorAll('li').forEach((li) => li.classList.remove('selected'));
          item.classList.add('selected');
          localStorage.setItem('selectedSearchEngine', item.textContent.trim().split(' ')[0]);
        }
      }

      searchSwitcher.querySelectorAll('li').forEach((item) => {
        item.addEventListener('mousedown', () => {
          cachedSelectedText = getSelectedText({ extensionContainer, shadow });
        });

        item.addEventListener('click', (event) => {
          openSearch(event.target.closest('li'));
        });
      });

      floatingButton.addEventListener('click', (event) => {
        if (event.altKey) {
          chrome.runtime.sendMessage(
            {
              action: 'openSidePanel',
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  'Failed to open side panel:',
                  chrome.runtime.lastError.message,
                );
              }
            },
          );
        } else {
          sidebarContainer.classList.remove('collapsed');
        }
      });

      sidebarContainer.addEventListener('mouseleave', () => {
        sidebarContainer.classList.add('collapsed');
      });

      const styleSheet = document.createElement('style');
      styleSheet.type = 'text/css';
      styleSheet.textContent = getContentStyles({
        doNotShowAgainLabel: chrome.i18n.getMessage('doNotShowAgain'),
      });
      shadow.appendChild(styleSheet);

      const style = document.createElement('style');
      style.textContent = getNonSelectableStyles();
      shadow.appendChild(style);

      function updateFloatingBallVisibility(enabled) {
        isFloatingBallEnabled = enabled;
        if (floatingButton) {
          floatingButton.style.display = enabled ? 'flex' : 'none';
        }
        if (sidebarContainer && !enabled) {
          sidebarContainer.classList.add('collapsed');
        }
      }

      chrome.storage.sync.get(['enableFloatingBall'], (result) => {
        updateFloatingBallVisibility(result.enableFloatingBall !== false);
      });

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateFloatingBall') {
          updateFloatingBallVisibility(request.enabled);
          sendResponse({ success: true });
        }
        return true;
      });

      floatingButton.style.display = isFloatingBallEnabled ? 'flex' : 'none';

      chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'loadDefaultBookmark') {
          void displayBookmarks({ shadow, chromeRef: chrome });
        }

        if (request.action === 'updateBookmarkDisplay') {
          const { folderId } = request;
          if (folderId) {
            void displayBookmarks({ shadow, chromeRef: chrome });
          }
        }
      });

      void displayBookmarks({ shadow, chromeRef: chrome });

      const autoInput = new AutoInputManager(siteConfigs);
      void autoInput.start();

      console.log('[Content Script] Content script initialized');
    } catch (error) {
      console.error('Failed to initialize content script:', error);
    }
  };

  if (document.body) {
    await bootstrap();
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        void bootstrap();
      },
      { once: true },
    );
  }
})();
