// 侧边栏导航脚本
(function() {
  console.log('[SidePanel Navigation] 脚本开始加载');
  const ENABLE_HISTORY_MONKEY_PATCH = false;

  // 在 iframe 中不注入，减少页面侵入和重复执行
  if (window.top !== window.self) {
    return;
  }

  // 检查Chrome API是否可用
  const isChromeExtension = typeof chrome !== 'undefined' &&
                            typeof chrome.runtime !== 'undefined' &&
                            typeof chrome.storage !== 'undefined';

  // 检查当前页面是否是侧边栏页面
  const isSidePanelPage = window.location.pathname.endsWith('sidepanel.html');

  // 检查URL参数中是否包含侧边栏标记
  const urlParams = new URLSearchParams(window.location.search);
  const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';

  // 检查当前页面是否是主页面（newtab）
  const isNewTabPage = window.location.pathname.endsWith('index.html') ||
                      window.location.pathname.endsWith('newtab.html') ||
                      window.location.href.includes('chrome://newtab') ||
                      document.querySelector('#sidebar-container') !== null;

  // 只有当URL中包含侧边栏参数时才继续，或者如果这是新标签页/侧边栏主页则不添加导航栏
  if (isSidePanelPage || isNewTabPage || !hasSidePanelParam) {
    console.log('[SidePanel Navigation] Not adding navigation bar: isSidePanelPage=', isSidePanelPage,
                'isNewTabPage=', isNewTabPage, 'hasSidePanelParam=', hasSidePanelParam);
    return;
  }

  function resolveModuleUrl(fileName) {
    if (isChromeExtension && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`src/content/${fileName}`);
    }

    if (document.currentScript && document.currentScript.src) {
      return new URL(fileName, document.currentScript.src).toString();
    }

    return fileName;
  }

  function loadModule(fileName) {
    const url = resolveModuleUrl(fileName);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);

    try {
      xhr.send(null);
    } catch (e) {
      throw new Error(`[SidePanel Navigation] Failed to load ${fileName}: ${e.message}`);
    }

    const ok = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 0;
    if (!ok && xhr.responseText === '') {
      throw new Error(`[SidePanel Navigation] Failed to load ${fileName}: status ${xhr.status}`);
    }

    (0, eval)(xhr.responseText);
  }

  function loadModules() {
    loadModule('sidepanel-navigation-utils.js');
    loadModule('sidepanel-navigation-bar.js');
    loadModule('sidepanel-navigation-detection.js');
  }

  try {
    loadModules();
  } catch (e) {
    console.error('[SidePanel Navigation] 模块加载失败:', e);
    return;
  }

  const namespace = window.SidePanelNavigation;
  if (!namespace ||
      typeof namespace.createNavigationBarController !== 'function' ||
      typeof namespace.createDetectionController !== 'function') {
    console.error('[SidePanel Navigation] 模块初始化失败: missing controller factories');
    return;
  }

  // 全局变量用于状态跟踪和调试
  const state = {
    inSidePanel: false,
    detectionMethods: [],
    detectionAttempts: 0,
    navigationBarAdded: false
  };

  const navigationController = namespace.createNavigationBarController({
    isChromeExtension
  });

  const detectionController = namespace.createDetectionController({
    state,
    isChromeExtension,
    initOrRefreshNavigationBar: navigationController.initOrRefreshNavigationBar
  });

  const showLoadingSpinner = namespace.showLoadingSpinner;
  const runDetectionMethods = detectionController.runDetectionMethods;
  const initOrRefreshNavigationBar = navigationController.initOrRefreshNavigationBar;

  // 在页面加载完成后，再次检查是否需要添加导航栏
  window.addEventListener('load', function() {
    if (state.navigationBarAdded) return;

    const urlParams = new URLSearchParams(window.location.search);
    const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' ||
                            urlParams.get('is_sidepanel') === 'true';

    if (hasSidePanelParam && !document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] 页面加载完成后检测到侧边栏参数，添加导航栏');
      state.inSidePanel = true;
      initOrRefreshNavigationBar();
      state.navigationBarAdded = true;

      document.body.classList.add('is-sidepanel');
    }
  });

  // 添加全局事件监听器 - 这是直接注入脚本发出的信号
  document.addEventListener('sidepanel_loaded', (event) => {
    console.log('[SidePanel Navigation] 接收到自定义事件:', event.detail);
    state.inSidePanel = true;

    if (!state.navigationBarAdded) {
      initOrRefreshNavigationBar();
      state.navigationBarAdded = true;
    }
  });

  // Chrome消息监听器 - 来自background.js的消息
  if (isChromeExtension) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[SidePanel Navigation] 收到Chrome消息:', message);

      try {
        if (message && message.action === 'sidepanelNavigation' && message.isSidePanel === true) {
          console.log('[SidePanel Navigation] 收到侧边栏标记消息:', message);

          try {
            sessionStorage.setItem('sidepanel_view', 'true');
            localStorage.setItem('sidepanel_view', 'true');
          } catch (e) {
            console.log('[SidePanel Navigation] 存储标记时出错:', e);
          }

          state.inSidePanel = true;

          if (!state.navigationBarAdded) {
            initOrRefreshNavigationBar();
            state.navigationBarAdded = true;
          }

          if (sendResponse) {
            sendResponse({ success: true, message: 'Sidepanel navigation message received' });
          }
          return true;
        }
      } catch (e) {
        console.error('[SidePanel Navigation] 处理消息时出错:', e);
        if (sendResponse) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
    });
  }

  // 添加全局链接点击事件监听，显示加载指示器
  document.addEventListener('click', function(event) {
    let linkElement = event.target.closest('a');

    if (linkElement &&
        linkElement.href &&
        (!linkElement.target || linkElement.target !== '_blank') &&
        !event.ctrlKey &&
        !event.metaKey) {
      showLoadingSpinner();

      try {
        const linkUrl = new URL(linkElement.href);

        if (!linkUrl.searchParams.has('sidepanel_view')) {
          linkUrl.searchParams.set('sidepanel_view', 'true');
          linkElement.href = linkUrl.toString();
          console.log('[SidePanel Navigation] 添加侧边栏参数到链接:', linkElement.href);
        }
      } catch (e) {
        console.error('[SidePanel Navigation] 修改链接URL时出错:', e);
      }

      if (state.inSidePanel && isChromeExtension) {
        try {
          const targetUrl = linkElement.href;

          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: targetUrl,
            source: 'in_page_navigation'
          }, response => {
            console.log('[SidePanel Navigation] 记录内部导航历史响应:', response);
          });

          console.log('[SidePanel Navigation] 记录内部导航到:', targetUrl);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录内部导航时出错:', e);
        }
      }
    }
  });

  // 添加历史记录变化监听
  if (ENABLE_HISTORY_MONKEY_PATCH && state.inSidePanel && window.history && window.history.pushState) {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(stateArg, title, url) {
      if (url) {
        try {
          const newUrl = new URL(url, window.location.href);
          if (!newUrl.searchParams.has('sidepanel_view')) {
            newUrl.searchParams.set('sidepanel_view', 'true');
            url = newUrl.toString();
            console.log('[SidePanel Navigation] 添加侧边栏参数到pushState URL:', url);
          }
        } catch (e) {
          console.error('[SidePanel Navigation] 修改pushState URL时出错:', e);
        }
      }

      const result = originalPushState.apply(this, arguments.length === 3 ? [stateArg, title, url] : arguments);

      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'pushState'
          });
          console.log('[SidePanel Navigation] 记录pushState导航:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录pushState导航时出错:', e);
        }
      }

      return result;
    };

    window.history.replaceState = function(stateArg, title, url) {
      if (url) {
        try {
          const newUrl = new URL(url, window.location.href);
          if (!newUrl.searchParams.has('sidepanel_view')) {
            newUrl.searchParams.set('sidepanel_view', 'true');
            url = newUrl.toString();
            console.log('[SidePanel Navigation] 添加侧边栏参数到replaceState URL:', url);
          }
        } catch (e) {
          console.error('[SidePanel Navigation] 修改replaceState URL时出错:', e);
        }
      }

      const result = originalReplaceState.apply(this, arguments.length === 3 ? [stateArg, title, url] : arguments);

      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'replaceState'
          });
          console.log('[SidePanel Navigation] 记录replaceState导航:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录replaceState导航时出错:', e);
        }
      }

      return result;
    };

    window.addEventListener('popstate', function() {
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'popstate'
          });
          console.log('[SidePanel Navigation] 记录popstate导航:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录popstate导航时出错:', e);
        }
      }
    });
  }

  // 执行多种检测方法并汇总结果
  runDetectionMethods();

  // 后备检测 - 每秒检查一次，共检查5次
  const maxBackupChecks = 5;
  for (let i = 0; i < maxBackupChecks; i++) {
    setTimeout(() => {
      if (!state.navigationBarAdded) {
        console.log(`[SidePanel Navigation] 后备检测 #${i + 1}`);
        runDetectionMethods();
      }
    }, (i + 1) * 1000);
  }
})();
