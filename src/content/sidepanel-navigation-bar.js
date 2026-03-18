// 侧边栏导航栏逻辑
(function() {
  const namespace = window.SidePanelNavigation = window.SidePanelNavigation || {};

  namespace.createNavigationBarController = function createNavigationBarController({ isChromeExtension }) {
    function initOrRefreshNavigationBar() {
      if (document.querySelector('.sidepanel-nav-bar')) {
        console.log('[SidePanel Navigation] 导航栏已存在，不需要再次添加');
        return;
      }

      console.log('[SidePanel Navigation] 初始化导航栏');
      initializeNavigationBar();

      // 在DOMContentLoaded后进行二次检查，确保导航栏存在
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureNavigationBar);
      } else {
        ensureNavigationBar();
      }

      // 在网页加载后也检查一次，处理某些异步加载的网站
      if (document.readyState !== 'complete') {
        window.addEventListener('load', ensureNavigationBar);
      } else {
        ensureNavigationBar();
      }

      // 设置一个MutationObserver以确保导航栏不被移除
      setupMutationObserver(document.querySelector('.sidepanel-nav-bar'));
    }

    function ensureNavigationBar() {
      if (!document.querySelector('.sidepanel-nav-bar')) {
        console.log('[SidePanel Navigation] Navigation bar not found, reinitializing');
        initializeNavigationBar();
      }
    }

    function setupMutationObserver(navBar) {
      if (!navBar) {
        console.log('[SidePanel Navigation] No navigation bar to observe');
        return null;
      }

      console.log('[SidePanel Navigation] Setting up mutation observer for navigation bar');

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const navBarStillExists = document.body.contains(navBar);

            if (!navBarStillExists) {
              console.log('[SidePanel Navigation] Navigation bar was removed, adding it back');
              initializeNavigationBar();

              const newNavBar = document.querySelector('.sidepanel-nav-bar');
              if (newNavBar && newNavBar !== navBar) {
                setupMutationObserver(newNavBar);
                observer.disconnect();
                return;
              }
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      const ensureNavBarExists = () => {
        const navBarExists = document.querySelector('.sidepanel-nav-bar');
        if (!navBarExists) {
          console.log('[SidePanel Navigation] Navigation bar not found on page load, adding it');
          initializeNavigationBar();
        }
      };

      if (document.readyState !== 'complete') {
        window.addEventListener('load', ensureNavBarExists, { once: true });
      }

      return observer;
    }

    function initializeNavigationBar() {
      console.log('[SidePanel Navigation] Initializing navigation bar for:', window.location.href);

      if (document.querySelector('.sidepanel-nav-bar')) {
        console.log('[SidePanel Navigation] Navigation bar already exists, not adding again');
        return;
      }

      const style = document.createElement('style');
      style.textContent = `
      .sidepanel-nav-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background-color: rgba(248, 249, 250, 0.95);
        border-bottom: 1px solid #dee2e6;
        display: flex;
        align-items: center;
        padding: 0 5px;
        z-index: 99999 !important;
        font-family: Arial, sans-serif;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        transition: transform 0.3s ease, opacity 0.3s ease;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar.compact-mode {
        transform: translateY(-28px);
      }
      
      .sidepanel-nav-bar.compact-mode:hover,
      .sidepanel-nav-bar:has(.url-display:focus) {
        transform: translateY(0);
      }
      
      .sidepanel-nav-bar .toggle-compact {
        position: absolute;
        bottom: -14px;
        left: 50%;
        transform: translateX(-50%);
        width: 28px;
        height: 14px;
        background-color: rgba(248, 249, 250, 0.95);
        border: 1px solid #dee2e6;
        border-top: none;
        border-radius: 0 0 14px 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        z-index: 99998 !important;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar .toggle-compact svg {
        width: 12px;
        height: 12px;
        transition: transform 0.3s ease;
      }
      
      .sidepanel-nav-bar.compact-mode .toggle-compact svg {
        transform: rotate(180deg);
      }
      
      .sidepanel-nav-bar button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px 5px;
        margin-right: 3px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar button:hover {
        background-color: #e9ecef;
      }
      
      .sidepanel-nav-bar button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .sidepanel-nav-bar button svg {
        width: 14px;
        height: 14px;
      }
      
      .sidepanel-nav-bar .url-display {
        flex-grow: 1;
        margin: 0 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: #666;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid transparent;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar .url-display:hover {
        border-color: #dee2e6;
        background-color: white;
      }
      
      body {
        margin-top: 32px !important;
        transition: margin-top 0.3s ease;
      }
      
      body.nav-compact-mode {
        margin-top: 4px !important;
      }
      
      @media (prefers-color-scheme: dark) {
        .sidepanel-nav-bar {
          background-color: rgba(41, 42, 45, 0.95);
          border-bottom-color: #3c4043;
          color: #e8eaed;
        }
        
        .sidepanel-nav-bar .toggle-compact {
          background-color: rgba(41, 42, 45, 0.95);
          border-color: #3c4043;
        }
        
        .sidepanel-nav-bar button {
          color: #e8eaed;
        }
        
        .sidepanel-nav-bar button:hover {
          background-color: #3c4043;
        }
        
        .sidepanel-nav-bar .url-display {
          color: #9aa0a6;
        }
        
        .sidepanel-nav-bar .url-display:hover {
          background-color: #202124;
          border-color: #3c4043;
        }
      }
      
      .sidepanel-nav-bar {
        opacity: 1 !important;
        visibility: visible !important;
        display: flex !important;
      }
    `;
      document.head.appendChild(style);

      const navBar = document.createElement('div');
      navBar.className = 'sidepanel-nav-bar';
      navBar.id = 'sidepanel-navigation-bar';

      const homeButton = document.createElement('button');
      homeButton.title = '返回书签列表';
      homeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
      homeButton.addEventListener('click', () => {
        if (isChromeExtension) {
          chrome.runtime.sendMessage({ action: 'navigateHome' });
        } else {
          console.log('[SidePanel Navigation] Chrome Extension API not available for navigateHome');
        }
      });

      const backButton = document.createElement('button');
      backButton.title = '返回上一页';
      backButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
      backButton.disabled = true;
      backButton.addEventListener('click', () => {
        if (isChromeExtension) {
          chrome.runtime.sendMessage({ action: 'navigateBack' });
        } else {
          console.log('[SidePanel Navigation] Chrome Extension API not available for navigateBack');
          window.history.back();
        }
      });

      const forwardButton = document.createElement('button');
      forwardButton.title = '前进到下一页';
      forwardButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
      forwardButton.disabled = true;
      forwardButton.addEventListener('click', () => {
        if (isChromeExtension) {
          chrome.runtime.sendMessage({ action: 'navigateForward' });
        } else {
          console.log('[SidePanel Navigation] Chrome Extension API not available for navigateForward');
          window.history.forward();
        }
      });

      const refreshButton = document.createElement('button');
      refreshButton.title = '刷新页面';
      refreshButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
      refreshButton.addEventListener('click', () => {
        namespace.refreshWithNavigation();
      });

      const openInNewTabButton = document.createElement('button');
      openInNewTabButton.title = '在新标签页中打开';
      openInNewTabButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
      openInNewTabButton.addEventListener('click', () => {
        if (isChromeExtension) {
          chrome.tabs.create({ url: window.location.href });
        } else {
          console.log('[SidePanel Navigation] Chrome Extension API not available for openInNewTab');
          window.open(window.location.href, '_blank');
        }
      });

      const urlDisplay = document.createElement('div');
      urlDisplay.className = 'url-display';
      urlDisplay.textContent = window.location.href;

      const toggleCompact = document.createElement('div');
      toggleCompact.className = 'toggle-compact';
      toggleCompact.title = '切换导航栏模式';
      toggleCompact.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';
      toggleCompact.addEventListener('click', () => {
        navBar.classList.toggle('compact-mode');
        document.body.classList.toggle('nav-compact-mode');

        if (isChromeExtension) {
          chrome.storage.local.set({
            'sidepanel_nav_compact_mode': navBar.classList.contains('compact-mode')
          });
        } else {
          console.log('[SidePanel Navigation] Chrome Extension API not available for storage');
          try {
            localStorage.setItem('sidepanel_nav_compact_mode', navBar.classList.contains('compact-mode'));
          } catch (e) {
            console.log('[SidePanel Navigation] localStorage not available:', e);
          }
        }
      });

      navBar.appendChild(homeButton);
      navBar.appendChild(backButton);
      navBar.appendChild(forwardButton);
      navBar.appendChild(refreshButton);
      navBar.appendChild(openInNewTabButton);
      navBar.appendChild(urlDisplay);
      navBar.appendChild(toggleCompact);

      document.body.insertBefore(navBar, document.body.firstChild);

      setupMutationObserver(navBar);

      if (isChromeExtension) {
        chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex', 'sidepanel_nav_compact_mode'], (result) => {
          if (result.sidepanel_nav_compact_mode) {
            navBar.classList.add('compact-mode');
            document.body.classList.add('nav-compact-mode');
          }

          if (result.sidePanelHistory && result.sidePanelCurrentIndex !== undefined) {
            const history = result.sidePanelHistory;
            const currentIndex = result.sidePanelCurrentIndex;

            backButton.disabled = currentIndex <= 0;
            forwardButton.disabled = currentIndex >= history.length - 1;

            console.log('[SidePanel Navigation] Loaded history state:', {
              historyLength: history.length,
              currentIndex: currentIndex,
              canGoBack: currentIndex > 0,
              canGoForward: currentIndex < history.length - 1
            });
          } else {
            console.log('[SidePanel Navigation] No history state found in storage');
          }
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          try {
            if (message && message.action === 'updateNavigationState') {
              console.log('[SidePanel Navigation] Received navigation state update:', message);

              const currentNavBar = document.querySelector('.sidepanel-nav-bar');
              if (currentNavBar) {
                const buttons = currentNavBar.querySelectorAll('button');
                const currentBackButton = buttons[1];
                const currentForwardButton = buttons[2];

                if (currentBackButton && currentForwardButton) {
                  currentBackButton.disabled = !message.canGoBack;
                  currentForwardButton.disabled = !message.canGoForward;
                  console.log('[SidePanel Navigation] Updated navigation buttons - Back:',
                            !message.canGoBack ? 'disabled' : 'enabled',
                            'Forward:', !message.canGoForward ? 'disabled' : 'enabled');
                } else {
                  console.log('[SidePanel Navigation] Could not find navigation buttons');
                }
              } else {
                console.log('[SidePanel Navigation] Navigation bar not found');
                initOrRefreshNavigationBar();
              }

              if (sendResponse) {
                sendResponse({ success: true, message: 'Navigation state updated' });
              }
            }
          } catch (e) {
            console.error('[SidePanel Navigation] Error processing navigation state update:', e);
            if (sendResponse) {
              sendResponse({ success: false, error: e.message });
            }
          }

          return true;
        });
      } else {
        backButton.disabled = !window.history.length;
        forwardButton.disabled = true;

        try {
          const compactMode = localStorage.getItem('sidepanel_nav_compact_mode') === 'true';
          if (compactMode) {
            navBar.classList.add('compact-mode');
            document.body.classList.add('nav-compact-mode');
          }
        } catch (e) {
          console.log('[SidePanel Navigation] localStorage not available:', e);
        }
      }

      setTimeout(() => {
        if (!document.body.contains(navBar)) {
          console.log('[SidePanel Navigation] Navigation bar was not properly added, retrying');
          document.body.insertBefore(navBar, document.body.firstChild);
        }
      }, 500);
    }

    return {
      initOrRefreshNavigationBar
    };
  };
})();
