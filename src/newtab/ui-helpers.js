export function setVersionNumber() {
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.querySelector('.about-version');
  
  if (versionElement && manifest) {
    // 移除 data-i18n 属性，因为我们要直接设置完整的本地化文本
    versionElement.removeAttribute('data-i18n');
    
    // 获取本地化的版本号文本并设置
    const versionText = chrome.i18n.getMessage('version', [manifest.version]);
    versionElement.textContent = versionText;
  }
}



export function updateDefaultFoldersTabsVisibility() {
  const defaultFoldersTabs = document.querySelector('.default-folders-tabs');
  const sidebarContainer = document.getElementById('sidebar-container');
  const tabsContainer = document.querySelector('.tabs-container');

  if (!defaultFoldersTabs || !tabsContainer) return;

  // 检查标签数量
  const folderTabs = tabsContainer.querySelectorAll('.folder-tab');
  defaultFoldersTabs.classList.toggle('show', folderTabs.length > 1);

  // 处理侧边栏状态
  if (sidebarContainer) {
    defaultFoldersTabs.classList.toggle('sidebar-expanded', !sidebarContainer.classList.contains('collapsed'));
    defaultFoldersTabs.classList.toggle('sidebar-collapsed', sidebarContainer.classList.contains('collapsed'));
  }
}



export function openSettingsModal() {
  const settingsManager = globalThis.__tabmarkSettingsManager;
  if (settingsManager && typeof settingsManager.openSettingsSidebar === 'function') {
    settingsManager.openSettingsSidebar();
    return;
  }

  // 修改为打开侧边栏
  const settingsSidebar = document.getElementById('settings-sidebar');
  const settingsOverlay = document.getElementById('settings-overlay');
  
  if (settingsSidebar && settingsOverlay) {
    settingsSidebar.classList.add('open');
    settingsOverlay.classList.add('open');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
  } else {
    console.error('Settings sidebar not found');
  }
}



export function initScrollIndicator() {
  const bookmarksContainer = document.querySelector('.bookmarks-container');
  const bookmarksList = document.getElementById('bookmarks-list');
  
  if (!bookmarksContainer || !bookmarksList) return;
  
  // 创建滚动指示器
  const scrollIndicator = document.createElement('div');
  scrollIndicator.className = 'scroll-indicator';
  scrollIndicator.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="7 13 12 18 17 13"></polyline>
      <polyline points="7 6 12 11 17 6"></polyline>
    </svg>
  `;
  bookmarksContainer.appendChild(scrollIndicator);
  
  // 滚动状态变量
  let scrollTimeout;
  let isScrolling = false;
  
  // 检查是否需要滚动
  function checkScrollable() {
    const isScrollable = bookmarksList.scrollHeight > bookmarksList.clientHeight;
    
    if (isScrollable) {
      scrollIndicator.style.display = 'flex';
      // 添加动画类
      if (!scrollIndicator.classList.contains('animate')) {
        scrollIndicator.classList.add('animate');
        // 5秒后移除动画
        setTimeout(() => {
          scrollIndicator.classList.remove('animate');
        }, 5000);
      }
    } else {
      scrollIndicator.style.display = 'none';
    }
  }
  
  // 监听滚动事件
  bookmarksList.addEventListener('scroll', () => {
    // 如果已经滚动到底部，隐藏指示器
    const isAtBottom = bookmarksList.scrollHeight - bookmarksList.scrollTop <= bookmarksList.clientHeight + 10;
    if (isAtBottom) {
      scrollIndicator.style.opacity = '0';
    } else {
      scrollIndicator.style.opacity = '';
    }
    
    // 添加滚动中的类
    if (!isScrolling) {
      isScrolling = true;
      bookmarksList.classList.add('scrolling');
    }
    
    // 清除之前的定时器
    clearTimeout(scrollTimeout);
    
    // 设置新的定时器，滚动停止1.5秒后移除滚动中的类
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
      bookmarksList.classList.remove('scrolling');
    }, 1500);
  });
  
  // 鼠标进入书签列表时，如果可滚动，添加滚动中的类
  bookmarksList.addEventListener('mouseenter', () => {
    if (bookmarksList.scrollHeight > bookmarksList.clientHeight) {
      bookmarksList.classList.add('scrolling');
      
      // 鼠标离开时，如果不在滚动，移除滚动中的类
      const handleMouseLeave = () => {
        if (!isScrolling) {
          bookmarksList.classList.remove('scrolling');
        }
        bookmarksList.removeEventListener('mouseleave', handleMouseLeave);
      };
      
      bookmarksList.addEventListener('mouseleave', handleMouseLeave);
    }
  });
  
  // 初始检查和窗口大小变化时重新检查
  checkScrollable();
  window.addEventListener('resize', _.debounce(checkScrollable, 200));
  
  // 当书签列表内容变化时重新检查
  const observer = new MutationObserver(_.debounce(checkScrollable, 200));
  observer.observe(bookmarksList, { childList: true, subtree: true });
  
  // 点击指示器滚动到下一屏
  scrollIndicator.addEventListener('click', () => {
    const currentScroll = bookmarksList.scrollTop;
    const nextScroll = currentScroll + bookmarksList.clientHeight * 0.8;
    bookmarksList.scrollTo({
      top: nextScroll,
      behavior: 'smooth'
    });
    
    // 点击时添加滚动中的类
    bookmarksList.classList.add('scrolling');
    isScrolling = true;
    
    // 清除之前的定时器
    clearTimeout(scrollTimeout);
    
    // 设置新的定时器
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
      bookmarksList.classList.remove('scrolling');
    }, 1500);
  });

  // 监听触摸事件，支持触摸设备
  bookmarksList.addEventListener('touchstart', () => {
    bookmarksList.classList.add('scrolling');
    isScrolling = true;
    
    // 清除之前的定时器
    clearTimeout(scrollTimeout);
  });
  
  bookmarksList.addEventListener('touchend', () => {
    // 设置新的定时器，触摸结束后1.5秒移除滚动中的类
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
      bookmarksList.classList.remove('scrolling');
    }, 1500);
  });
  
  // 初始检查和窗口大小变化时重新检查
}
