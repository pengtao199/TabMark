import {
  SearchEngineManager,
  updateSearchEngineIcon,
  createSearchEngineDropdown,
  initializeSearchEngineDialog
} from '../search-engine-dropdown.js';
import { initScrollIndicator } from '../ui-helpers.js';
import { setupSpecialLinks } from './special-links.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
document.addEventListener('DOMContentLoaded', () => {
  const defaultEngine = SearchEngineManager.getDefaultEngine();
  if (defaultEngine) {
    updateSearchEngineIcon(defaultEngine);
  }
});

// 同样，将这个函数也移到全作用域
// 1. 首先定义全局变量
let bookmarksList;
let itemHeight = 120;
let bufferSize = 5;
let visibleItems;
let allBookmarks = [];
let renderTimeout = null;
let scrollHandler = null;
let resizeObserver = null;

// 2. 定义主要的虚拟滚动函数
function initVirtualScroll() {
  bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList) return;
  
  visibleItems = Math.ceil(window.innerHeight / itemHeight) + 2 * bufferSize;

  // 渲染函数
  function renderVisibleBookmarks() {
    if (!bookmarksList) return;
    // ... 保持原有的 renderVisibleBookmarks 实现 ...
  }

  // 滚动处理函数
  const handleScroll = _.throttle(() => {
    if (renderTimeout) {
      cancelAnimationFrame(renderTimeout);
    }
    renderTimeout = requestAnimationFrame(renderVisibleBookmarks);
  }, 16);

  // 窗口大小变化处理函数
  function handleResize() {
    const newVisibleItems = Math.ceil(window.innerHeight / itemHeight) + 2 * bufferSize;
    if (newVisibleItems !== visibleItems) {
      visibleItems = newVisibleItems;
      renderVisibleBookmarks();
    }
  }

  // 清理函数
  function cleanup() {
    if (scrollHandler) {
      bookmarksList.removeEventListener('scroll', scrollHandler);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (renderTimeout) {
      cancelAnimationFrame(renderTimeout);
    }
    allBookmarks = [];
  }

  // 初始化事件监听
  function initializeListeners() {
    cleanup(); // 清理旧的监听器

    scrollHandler = handleScroll;
    bookmarksList.addEventListener('scroll', scrollHandler, { passive: true });

    // 确保 handleResize 在正确的作用域内
    const boundHandleResize = handleResize.bind(this);
    resizeObserver = new ResizeObserver(_.debounce(boundHandleResize, 100));
    resizeObserver.observe(bookmarksList);
  }

  // 更新书签显示
  window.updateBookmarksDisplay = function(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        cleanup();
        allBookmarks = bookmarks;
        
        updateContainerHeight();
        S.updateFolderName(parentId);
        renderVisibleBookmarks();
        
        bookmarksList.dataset.parentId = parentId;
        initializeListeners();
        
        resolve();
      });
    });
  };

  // 初始化
  initializeListeners();
}

// 3. 合并 DOMContentLoaded 事件监听器
document.addEventListener('DOMContentLoaded', function() {
  // 初始化虚拟滚动
  initVirtualScroll();
  
  // 初始化滚动指示器
  initScrollIndicator();
  
  // 其他初始化代码...
  if (S.startPeriodicSync) {
    S.startPeriodicSync();
  }
  setupSpecialLinks();
  console.log('[Init] Starting initialization...');

  // 只调用一次搜索引擎初始化
  createSearchEngineDropdown();
  initializeSearchEngineDialog();

 

  // 加载保存的背景颜色
  const savedBg = localStorage.getItem('selectedBackground');
  const useDefaultBackground = localStorage.getItem('useDefaultBackground');
  const hasWallpaper = localStorage.getItem('originalWallpaper');

  console.log('[Background] Initial load state:', {
    savedBg,
    useDefaultBackground,
    hasWallpaper
  });

  // 清除所有选项的 active 状态
  document.querySelectorAll('.settings-bg-option').forEach(opt => {
    opt.classList.remove('active');
  });

  if (savedBg) {
    if (useDefaultBackground === 'true') {
      console.log('[Background] Activating saved background color:', savedBg);
      document.documentElement.className = savedBg;
      const activeOption = document.querySelector(`[data-bg="${savedBg}"]`);
      if (activeOption) {
        activeOption.classList.add('active');
      }
    } else if (hasWallpaper) {
      console.log('[Background] Wallpaper is active, keeping background options unselected');
    }
  } else {
    console.log('[Background] No saved background, checking wallpaper state');
    if (!hasWallpaper && useDefaultBackground !== 'false') {
      console.log('[Background] No wallpaper, using default background');
      document.documentElement.className = 'gradient-background-7';
      const defaultOption = document.querySelector('[data-bg="gradient-background-7"]');
      if (defaultOption) {
        defaultOption.classList.add('active');
      }
    } else {
      console.log('[Background] Wallpaper exists, skipping default background');
      document.documentElement.className = '';
    }
  }

  // 如果有壁纸，激活对应的壁纸选项
  if (hasWallpaper) {
    const wallpaperOption = document.querySelector(`.wallpaper-option[data-wallpaper-url="${hasWallpaper}"]`);
    if (wallpaperOption) {
      console.log('[Background] Activating wallpaper option');
      wallpaperOption.classList.add('active');
    }
  }

  // 背景选项点击事件
  const bgOptions = document.querySelectorAll('.settings-bg-option');
  bgOptions.forEach(option => {
    option.addEventListener('click', function() {
      const bgClass = this.getAttribute('data-bg');
      console.log('[Background] Color option clicked:', {
        bgClass,
        previousBackground: document.documentElement.className,
        previousWallpaper: localStorage.getItem('originalWallpaper')
      });

      // 移除所有背景选项的 active 状态
      bgOptions.forEach(opt => {
        opt.classList.remove('active');
        console.log('[Background] Removing active state from:', opt.getAttribute('data-bg'));
      });
      
      // 添加当前选项的 active 状态
      this.classList.add('active');
      console.log('[Background] Setting active state for:', bgClass);
      
      document.documentElement.className = bgClass;
      localStorage.setItem('selectedBackground', bgClass);
      localStorage.setItem('useDefaultBackground', 'true');
      
      // 清除壁纸相关的状态
      document.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.classList.remove('active');
      });

      // 清除壁纸
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.style.backgroundImage = 'none';
        document.body.style.backgroundImage = 'none';
        console.log('[Background] Cleared wallpaper');
      }
      localStorage.removeItem('originalWallpaper');

      // 使用 WelcomeManager 更新欢迎消息颜色
      const welcomeElement = document.getElementById('welcome-message');
      if (welcomeElement && window.WelcomeManager) {
        window.WelcomeManager.adjustTextColor(welcomeElement);
      }
    });
  });

  // 监听主题变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        // 当背景类发生变化时，调整文字颜色
        requestAnimationFrame(() => {
          const welcomeElement = document.getElementById('welcome-message');
          if (welcomeElement && window.WelcomeManager) {
            window.WelcomeManager.adjustTextColor(welcomeElement);
          }
        });
      }
    });
  });

  // 开始观察 documentElement 的 class 变化
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // 初始化快捷链接显示状态
  chrome.storage.sync.get(['enableQuickLinks'], function(result) {
    const quickLinksWrapper = document.querySelector('.quick-links-wrapper');
    if (quickLinksWrapper) {
      quickLinksWrapper.style.display = result.enableQuickLinks !== false ? 'flex' : 'none';
    }
  });

  // 检测是否在 Side Panel 中运行
  const isSidePanel = window.location.search.includes('context=side_panel') || 
                     window.location.hash.includes('context=side_panel');
  
  if (isSidePanel) {
    document.body.classList.add('is-sidepanel');
    
    // 直接隐藏页脚 - 使用更直接的方法
    const footer = document.querySelector('footer');
    if (footer) {
      footer.style.display = 'none';
      footer.setAttribute('data-sidepanel-hidden', 'true'); // 添加标记以便于调试
    }
    
    // 隐藏一些在 Side Panel 中不需要的元素
    const elementsToHide = [
      '.theme-toggle',
      '#toggle-sidebar',
      '.links-icons',
      '.settings-icon'
    ];
    
    elementsToHide.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = 'none';
      }
    });
    
    // 调整布局和尺寸
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
      sidebarContainer.classList.add('is-sidepanel');
      // 在 Side Panel 中默认展开侧边栏
      sidebarContainer.classList.remove('collapsed');
    }

    // 调整主容器样式
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      mainContainer.style.padding = '1rem';
    }

    // 确保搜索框的动态高度调整功能正常工作
    const searchInput = document.querySelector('.search-input');
    if (searchInput && S.adjustTextareaHeight) {
      // 重新初始化搜索框高度
      S.adjustTextareaHeight();
      
      // 确保输入事件监听器正常工作
      searchInput.addEventListener('input', S.adjustTextareaHeight);
    }
    
    // 调整默认文件夹切换区域的位置
    const defaultFoldersTabs = document.querySelector('.default-folders-tabs');
    if (defaultFoldersTabs) {
      defaultFoldersTabs.style.bottom = '20px'; // 由于页脚被隐藏，调整底部距离
    }
    
    // 添加一个延迟检查，确保页脚真的被隐藏了
    setTimeout(() => {
      const footerCheck = document.querySelector('footer');
      if (footerCheck && footerCheck.style.display !== 'none') {
        console.log('Footer still visible, forcing hide');
        footerCheck.style.display = 'none !important';
        document.body.classList.add('force-hide-footer');
      }
    }, 500);
    
    // 隐藏欢迎语
    const welcomeMessage = document.getElementById('welcome-message');
    const welcomeContainer = document.querySelector('.welcome-search-container');
    
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
    
    if (welcomeContainer) {
      welcomeContainer.style.display = 'none';
    }
    
    // 调整搜索容器位置
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
      searchContainer.style.marginTop = '0.5rem';
      searchContainer.style.marginBottom = '1rem';
    }
  }

  // 应用保存的书签宽度设置
  chrome.storage.sync.get(['bookmarkWidth'], (result) => {
    const savedWidth = result.bookmarkWidth || 190;
    const bookmarksList = document.getElementById('bookmarks-list');
    if (bookmarksList) {
      bookmarksList.style.gridTemplateColumns = `repeat(auto-fill, minmax(${savedWidth}px, 1fr))`;
    }
  });

  // 应用保存的书签容器宽度设置
  chrome.storage.sync.get(['bookmarkContainerWidth'], (result) => {
    const savedWidth = result.bookmarkContainerWidth || 85; // 默认85%
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    if (bookmarksContainer) {
      bookmarksContainer.style.width = `${savedWidth}%`;
    }
  });

  // 应用保存的界面元素显示设置
  chrome.storage.sync.get(
    [
      'showSearchBox', 
      'showWelcomeMessage', 
      'showFooter',
      'showHistoryLink',
      'showDownloadsLink',
      'showPasswordsLink',
      'showExtensionsLink'
    ], 
    (result) => {
      // 应用搜索框显示设置 - 修改为默认隐藏
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        searchContainer.style.display = result.showSearchBox === true ? '' : 'none';
      }
      
      // 应用欢迎语显示设置
      const welcomeMessage = document.getElementById('welcome-message');
      if (welcomeMessage) {
        // 先移除初始的 visibility: hidden
        welcomeMessage.style.visibility = 'visible';
        // 然后根据设置决定是否显示
        welcomeMessage.style.display = result.showWelcomeMessage !== false ? '' : 'none';
      }
      
      // 应用页脚显示设置
      const footer = document.querySelector('footer');
      if (footer) {
        footer.style.display = result.showFooter !== false ? '' : 'none';
      }
      
      // 应用快捷链接图标显示设置
      const toggleElementVisibility = (selector, isVisible) => {
        const element = document.querySelector(selector);
        if (element) {
          element.style.display = isVisible ? '' : 'none';
        }
      };
      
      toggleElementVisibility('#history-link', result.showHistoryLink !== false);
      toggleElementVisibility('#downloads-link', result.showDownloadsLink !== false);
      toggleElementVisibility('#passwords-link', result.showPasswordsLink !== false);
      toggleElementVisibility('#extensions-link', result.showExtensionsLink !== false);
      
      // 检查是否所有链接都被隐藏
      const linksContainer = document.querySelector('.links-icons');
      if (linksContainer) {
        const allLinksHidden = 
          result.showHistoryLink === false && 
          result.showDownloadsLink === false && 
          result.showPasswordsLink === false && 
          result.showExtensionsLink === false;
        
        linksContainer.style.display = allLinksHidden ? 'none' : '';
      }
    }
  );
});

// 修改书签缓存对象的定义
const bookmarksCache = {
  data: new Map(),
  maxSize: 100, // 最大缓存条目数
  maxAge: 5 * 60 * 1000, // 5分钟缓存

  set(parentId, bookmarks) {
    // 如果缓存即将超出限制，清理最旧的数据
    if (this.data.size >= this.maxSize) {
      this.cleanup();
    }

    this.data.set(parentId, {
      timestamp: Date.now(),
      bookmarks: bookmarks
    });
  },

  get(parentId) {
    const cached = this.data.get(parentId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.maxAge) {
      this.data.delete(parentId);
      return null;
    }

    return cached;
  },

  // 添加 delete 方法
  delete(parentId) {
    return this.data.delete(parentId);
  },

  // 添加清除方法
  clear() {
    this.data.clear();
  },

  // 清理过期和最少使用缓存
  cleanup() {
    const now = Date.now();
    const entries = Array.from(this.data.entries());

    // 按最后访问时间排序
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // 删除最旧的 20% 缓存
    const deleteCount = Math.floor(entries.length * 0.2);
    entries.slice(0, deleteCount).forEach(([key]) => {
      this.data.delete(key);
    });
  }
};


assignToScriptState({ initVirtualScroll, bookmarksCache });
