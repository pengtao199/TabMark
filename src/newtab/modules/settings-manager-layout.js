import { SettingsManager } from './settings-manager-base.js';

  SettingsManager.prototype.initBookmarkWidthSettings = function() {
    // 获取元素引用
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    
    if (!this.widthSlider || !this.widthValue) {
      console.log('Width slider elements not found, skipping bookmark width settings initialization');
      return;
    }
    
    // 从存储中获取保存的宽度值
    chrome.storage.sync.get(['bookmarkWidth'], (result) => {
      const savedWidth = result.bookmarkWidth || 190; // 默认190px
      this.widthSlider.value = savedWidth;
      this.widthValue.textContent = savedWidth;
      this.updatePreviewCount(savedWidth);
      this.updateBookmarkWidth(savedWidth);
    });
    
    // 监听滑块的变化
    this.widthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.widthValue.textContent = width;
      this.updatePreviewCount(width);
      this.updateBookmarkWidth(width);
    });
      
    // 监听滑块的鼠标释放事件
    this.widthSlider.addEventListener('mouseup', () => {
      // 保存设置
      chrome.storage.sync.set({ bookmarkWidth: this.widthSlider.value });
    });
        
    // 添加窗口大小改变的监听
    const debouncedUpdate = this.debounce(() => {
      this.updatePreviewCount(this.widthSlider.value);
    }, 250);
    window.addEventListener('resize', debouncedUpdate);
  }
  
  // 新增书签卡片高度设置函数
  SettingsManager.prototype.initCardHeightSettings = function() {
    // 获取滑块和显示元素
    this.heightSlider = document.getElementById('height-slider');
    this.heightValue = document.getElementById('height-value');
    
    if (!this.heightSlider || !this.heightValue) {
      console.log('Height slider elements not found, skipping card height settings initialization');
      return;
    }
    
    // 从存储中获取保存的高度值
    chrome.storage.sync.get('bookmarkCardHeight', (result) => {
      const savedHeight = result.bookmarkCardHeight || 48; // 默认值为48px
      
      // 设置滑块和显示值
      this.heightSlider.value = savedHeight;
      this.heightValue.textContent = savedHeight;
      
      // 应用高度设置
      this.updateCardHeight(savedHeight);
    });
    
    // 监听滑块的变化
    this.heightSlider.addEventListener('input', (e) => {
      const height = e.target.value;
      this.heightValue.textContent = height;
      this.updateCardHeight(height);
    });
    
    // 监听滑块的鼠标释放事件
    this.heightSlider.addEventListener('mouseup', () => {
      // 保存设置
      chrome.storage.sync.set({ bookmarkCardHeight: this.heightSlider.value });
    });
  }
  
  // 更新书签卡片高度
  SettingsManager.prototype.updateCardHeight = function(height) {
    // 创建或更新自定义样式
    let styleElement = document.getElementById('custom-card-height');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-card-height';
      document.head.appendChild(styleElement);
    }
    
    // 设置卡片高度
    styleElement.textContent = `
      .card {
        height: ${height}px !important;
      }
    `;
  }

  SettingsManager.prototype.updatePreviewCount = function(width) {
    // 获取书签列表容器
    const bookmarksList = document.getElementById('bookmarks-list');
    if (!bookmarksList) return;

    // 确保容器可见
    const originalDisplay = bookmarksList.style.display;
    if (getComputedStyle(bookmarksList).display === 'none') {
      bookmarksList.style.display = 'grid';
    }

    // 获取容器的实际可用宽度
    const containerStyle = getComputedStyle(bookmarksList);
    const containerWidth = bookmarksList.offsetWidth 
      - parseFloat(containerStyle.paddingLeft) 
      - parseFloat(containerStyle.paddingRight);

    // 还原容器显示状态
    bookmarksList.style.display = originalDisplay;

    // 使用与 CSS Grid 相同的计算逻辑
    const gap = 16; // gap: 1rem
    const minWidth = parseInt(width);
    
    // 计算一行能容纳的最大数量
    // 使用 Math.floor 确保不会超出容器宽度
    const count = Math.floor((containerWidth + gap) / (minWidth + gap));
    
    // 更新显示 - 使用本地化文本
    const previewText = chrome.i18n.getMessage("bookmarksPerRow", [count]) || `${count} 个/行`;
    this.widthPreviewCount.textContent = previewText;
  }

  SettingsManager.prototype.updateBookmarkWidth = function(width) {
    // 更新CSS变量
    document.documentElement.style.setProperty('--bookmark-width', width + 'px');
    
    // 更新Grid布局
    const bookmarksList = document.getElementById('bookmarks-list');
    if (bookmarksList) {
      // 使用 minmax 确保最小宽度，但允许在空间足够时扩展
      bookmarksList.style.gridTemplateColumns = `repeat(auto-fit, minmax(${width}px, 1fr))`;
      // 设置 gap
      bookmarksList.style.gap = '1rem';
    }
  }

  SettingsManager.prototype.initContainerWidthSettings = function() {
    // 获取元素引用
    this.containerWidthSlider = document.getElementById('container-width-slider');
    this.containerWidthValue = document.getElementById('container-width-value');
    
    if (!this.containerWidthSlider || !this.containerWidthValue) {
      console.log('Container width slider elements not found, skipping container width settings initialization');
      return;
    }
    
    // 从存储中获取保存的宽度值
    chrome.storage.sync.get(['bookmarkContainerWidth'], (result) => {
      const savedWidth = result.bookmarkContainerWidth || 85; // 默认85%
      this.containerWidthSlider.value = savedWidth;
      this.containerWidthValue.textContent = savedWidth;
      this.updateContainerWidth(savedWidth);
    });
    
    // 监听滑块的变化
    this.containerWidthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.containerWidthValue.textContent = width;
      this.updateContainerWidth(width);
    });
    
    // 监听滑块的鼠标释放事件，保存设置
    this.containerWidthSlider.addEventListener('mouseup', () => {
      // 保存设置
      chrome.storage.sync.set({ bookmarkContainerWidth: this.containerWidthSlider.value });
    });
  }

  // 更新书签容器宽度的方法
  SettingsManager.prototype.updateContainerWidth = function(widthPercent) {
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    if (bookmarksContainer) {
      bookmarksContainer.style.width = `${widthPercent}%`;
    }
  }

  SettingsManager.prototype.initLayoutSettings = function() {
    // 获取元素引用
    this.showSearchBoxCheckbox = document.getElementById('show-search-box');
    this.showWelcomeMessageCheckbox = document.getElementById('show-welcome-message');
    this.showFooterCheckbox = document.getElementById('show-footer');

    // 添加快捷链接图标的设置
    this.showHistoryLinkCheckbox = document.getElementById('show-history-link');
    this.showDownloadsLinkCheckbox = document.getElementById('show-downloads-link');
    this.showPasswordsLinkCheckbox = document.getElementById('show-passwords-link');
    this.showExtensionsLinkCheckbox = document.getElementById('show-extensions-link');

    // 加载保存的设置
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
        // 设置复选框状态 - 修改搜索框的默认值为 false
        this.showSearchBoxCheckbox.checked = result.showSearchBox === true; // 默认为 false
        this.showWelcomeMessageCheckbox.checked = result.showWelcomeMessage !== false;
        this.showFooterCheckbox.checked = result.showFooter !== false;
        
        // 设置快捷链接图标的状态
        this.showHistoryLinkCheckbox.checked = result.showHistoryLink !== false;
        this.showDownloadsLinkCheckbox.checked = result.showDownloadsLink !== false;
        this.showPasswordsLinkCheckbox.checked = result.showPasswordsLink !== false;
        this.showExtensionsLinkCheckbox.checked = result.showExtensionsLink !== false;
        
        // 应用设置到界面
        this.toggleElementVisibility('#history-link', result.showHistoryLink !== false);
        this.toggleElementVisibility('#downloads-link', result.showDownloadsLink !== false);
        this.toggleElementVisibility('#passwords-link', result.showPasswordsLink !== false);
        this.toggleElementVisibility('#extensions-link', result.showExtensionsLink !== false);

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

    // 监听设置变化
    this.showSearchBoxCheckbox.addEventListener('change', () => {
      const isVisible = this.showSearchBoxCheckbox.checked;
      chrome.storage.sync.set({ showSearchBox: isVisible });
      
      // 立即应用设置
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        searchContainer.style.display = isVisible ? '' : 'none';
      }
      
      // 立即更新欢迎语显示
      if (window.WelcomeManager) {
        window.WelcomeManager.updateWelcomeMessage();
      }
    });

    this.showWelcomeMessageCheckbox.addEventListener('change', () => {
      const isVisible = this.showWelcomeMessageCheckbox.checked;
      chrome.storage.sync.set({ showWelcomeMessage: isVisible });
      
      // 立即应用设置
      const welcomeMessage = document.getElementById('welcome-message');
      if (welcomeMessage) {
        welcomeMessage.style.display = isVisible ? '' : 'none';
      }
    });

    this.showFooterCheckbox.addEventListener('change', () => {
      const isVisible = this.showFooterCheckbox.checked;
      chrome.storage.sync.set({ showFooter: isVisible });
      
      // 立即应用设置
      const footer = document.querySelector('footer');
      if (footer) {
        footer.style.display = isVisible ? '' : 'none';
      }
    });

    // 添加事件监听器
    this.showHistoryLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showHistoryLinkCheckbox.checked;
      chrome.storage.sync.set({ showHistoryLink: isVisible });
      this.toggleElementVisibility('#history-link', isVisible);
    });

    this.showDownloadsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showDownloadsLinkCheckbox.checked;
      chrome.storage.sync.set({ showDownloadsLink: isVisible });
      this.toggleElementVisibility('#downloads-link', isVisible);
    });

    this.showPasswordsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showPasswordsLinkCheckbox.checked;
      chrome.storage.sync.set({ showPasswordsLink: isVisible });
      this.toggleElementVisibility('#passwords-link', isVisible);
    });

    this.showExtensionsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showExtensionsLinkCheckbox.checked;
      chrome.storage.sync.set({ showExtensionsLink: isVisible });
      this.toggleElementVisibility('#extensions-link', isVisible);
    });
  }

  // 辅助方法：切换元素可见性
  SettingsManager.prototype.toggleElementVisibility = function(selector, isVisible) {
    const element = document.querySelector(selector);
    if (element) {
      element.style.display = isVisible ? '' : 'none';
      
      // 特殊处理 links-icons 容器
      if (selector.includes('link')) {
        const linksContainer = document.querySelector('.links-icons');
        if (linksContainer) {
          // 检查是否所有链接都被隐藏
          const visibleLinks = Array.from(linksContainer.querySelectorAll('a')).filter(
            link => link.style.display !== 'none'
          ).length;
          
          linksContainer.style.display = visibleLinks === 0 ? 'none' : '';
        }
      }
    }
  }
