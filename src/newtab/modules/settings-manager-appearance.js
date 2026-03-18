import { ICONS } from '../icons.js';
import { STORAGE_KEYS } from '../../shared/storage-keys.js';
import { SettingsManager } from './settings-manager-base.js';

  SettingsManager.prototype.handleBackgroundChange = function(option) {
    const bgClass = option.getAttribute('data-bg');
    
    // 移除所有背景选项的 active 状态
    this.bgOptions.forEach(opt => opt.classList.remove('active'));
    
    // 添加当前选项的 active 状态
    option.classList.add('active');
    
    document.documentElement.className = bgClass;
    localStorage.setItem('selectedBackground', bgClass);
    localStorage.setItem('useDefaultBackground', 'true');
    
    // 清除壁纸相关的状态
    this.clearWallpaper();
    
    // 更新欢迎消息
    if (window.WelcomeManager) {
      window.WelcomeManager.updateWelcomeMessage();
    }
  }

  SettingsManager.prototype.clearWallpaper = function() {
    document.querySelectorAll('.wallpaper-option').forEach(opt => {
      opt.classList.remove('active');
    });

    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.style.backgroundImage = 'none';
      document.body.style.backgroundImage = 'none';
    }
    localStorage.removeItem('originalWallpaper');

    // 更新欢迎消息颜色
    const welcomeElement = document.getElementById('welcome-message');
    if (welcomeElement && window.WelcomeManager) {
      window.WelcomeManager.adjustTextColor(welcomeElement);
    }
  }

  SettingsManager.prototype.loadSavedSettings = function() {
    // 加载悬浮球设置
    chrome.storage.sync.get([STORAGE_KEYS.ENABLE_FLOATING_BALL], (result) => {
      this.enableFloatingBallCheckbox.checked = result[STORAGE_KEYS.ENABLE_FLOATING_BALL] !== false;
    });

    // 加载背景设置
    const savedBg = localStorage.getItem('selectedBackground');
    if (savedBg) {
      document.documentElement.className = savedBg;
      this.bgOptions.forEach(option => {
        if (option.getAttribute('data-bg') === savedBg) {
          option.classList.add('active');
        }
      });
    }
  }

  SettingsManager.prototype.initTheme = function() {
    const themeSelect = document.getElementById('theme-select');
    const savedTheme = localStorage.getItem('theme') || 'auto';
    
    // 设置下拉菜单的初始值
    themeSelect.value = savedTheme;
    
    // 如果是自动模式，根据系统主题设置初始主题
    if (savedTheme === 'auto') {
      this.setThemeBasedOnSystem();
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeIcon(savedTheme === 'dark');
    }

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
      if (localStorage.getItem('theme') === 'auto') {
        const isDark = e.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark);
      }
    });

    // 监听主题选择变化
    themeSelect.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      localStorage.setItem('theme', selectedTheme);
      
      if (selectedTheme === 'auto') {
        this.setThemeBasedOnSystem();
      } else {
        document.documentElement.setAttribute('data-theme', selectedTheme);
        this.updateThemeIcon(selectedTheme === 'dark');
      }
    });

    // 保留原有的主题切换按钮功能
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeSelect.value = newTheme;
        
        this.updateThemeIcon(newTheme === 'dark');
      });
    }
  }

  SettingsManager.prototype.setThemeBasedOnSystem = function() {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcon(isDarkMode);
  }

  SettingsManager.prototype.updateThemeIcon = function(isDark) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;
    
    themeToggleBtn.innerHTML = isDark ? ICONS.dark_mode : ICONS.light_mode;
  }

  SettingsManager.prototype.initQuickLinksSettings = function() {
    // 加载快捷链接设置
    chrome.storage.sync.get(['enableQuickLinks'], (result) => {
      this.enableQuickLinksCheckbox.checked = result.enableQuickLinks !== false;
      this.toggleQuickLinksVisibility(this.enableQuickLinksCheckbox.checked);
    });

    // 监听快捷链接设置变化
    this.enableQuickLinksCheckbox.addEventListener('change', () => {
      const isEnabled = this.enableQuickLinksCheckbox.checked;
      chrome.storage.sync.set({ enableQuickLinks: isEnabled }, () => {
        this.toggleQuickLinksVisibility(isEnabled);
      });
    });
  }

  SettingsManager.prototype.toggleQuickLinksVisibility = function(show) {
    const quickLinksWrapper = document.querySelector('.quick-links-wrapper');
    if (quickLinksWrapper) {
      quickLinksWrapper.style.display = show ? 'flex' : 'none';
    }
  }

  SettingsManager.prototype.initFloatingBallSettings = function() {
    // 加载悬浮球设置
    chrome.storage.sync.get([STORAGE_KEYS.ENABLE_FLOATING_BALL], (result) => {
      this.enableFloatingBallCheckbox.checked = result[STORAGE_KEYS.ENABLE_FLOATING_BALL] !== false;
    });

    // 监听悬浮球设置变化
    this.enableFloatingBallCheckbox.addEventListener('change', () => {
      const isEnabled = this.enableFloatingBallCheckbox.checked;
      // 发送消息到 background script
      chrome.runtime.sendMessage({
        action: 'updateFloatingBallSetting',
        enabled: isEnabled
      }, () => {
        // 保存设置到 storage
        chrome.storage.sync.set({ [STORAGE_KEYS.ENABLE_FLOATING_BALL]: isEnabled });
      });
    });
  }

  SettingsManager.prototype.initLinkOpeningSettings = function() {
    // 检查元素是否存在
    if (!this.openInNewTabCheckbox) {
      console.log('openInNewTabCheckbox not found, skipping settings initialization');
      return;
    }
    
    // 检查侧边栏模式下的链接打开方式设置元素是否存在
    const hasSidepanelSettings = this.sidepanelOpenInNewTabCheckbox && this.sidepanelOpenInSidepanelCheckbox;
    
    // 加载链接打开方式设置
    chrome.storage.sync.get([STORAGE_KEYS.OPEN_IN_NEW_TAB], (result) => {
      this.openInNewTabCheckbox.checked = result[STORAGE_KEYS.OPEN_IN_NEW_TAB] !== false;
    });

    // 监听设置变化
    this.openInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openInNewTabCheckbox.checked;
      chrome.storage.sync.set({ [STORAGE_KEYS.OPEN_IN_NEW_TAB]: isEnabled });
    });
    
    // 如果侧边栏模式下的链接打开方式设置元素不存在，则跳过
    if (!hasSidepanelSettings) {
      console.log('Sidepanel checkboxes not found, skipping sidepanel settings initialization');
      return;
    }
    
    // 加载侧边栏模式下的链接打开方式设置
    chrome.storage.sync.get([STORAGE_KEYS.SIDEPANEL_OPEN_IN_NEW_TAB, STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL], (result) => {
      // 默认在新标签页中打开
      this.sidepanelOpenInNewTabCheckbox.checked = result[STORAGE_KEYS.SIDEPANEL_OPEN_IN_NEW_TAB] !== false;
      this.sidepanelOpenInSidepanelCheckbox.checked = result[STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL] === true;
      
      // 确保两个选项是互斥的
      if (this.sidepanelOpenInNewTabCheckbox.checked && this.sidepanelOpenInSidepanelCheckbox.checked) {
        // 如果两个都被选中，优先使用在新标签页中打开
        this.sidepanelOpenInSidepanelCheckbox.checked = false;
        chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL]: false });
      }
    });
    
    // 监听侧边栏模式下的链接打开方式设置变化
    this.sidepanelOpenInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.sidepanelOpenInNewTabCheckbox.checked;
      chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_OPEN_IN_NEW_TAB]: isEnabled });
      
      // 如果启用了在新标签页中打开，则禁用在侧边栏内打开
      if (isEnabled && this.sidepanelOpenInSidepanelCheckbox.checked) {
        this.sidepanelOpenInSidepanelCheckbox.checked = false;
        chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL]: false });
      }
    });
    
    this.sidepanelOpenInSidepanelCheckbox.addEventListener('change', () => {
      const isEnabled = this.sidepanelOpenInSidepanelCheckbox.checked;
      chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_OPEN_IN_SIDEPANEL]: isEnabled });
      
      // 如果启用了在侧边栏内打开，则禁用在新标签页中打开
      if (isEnabled && this.sidepanelOpenInNewTabCheckbox.checked) {
        this.sidepanelOpenInNewTabCheckbox.checked = false;
        chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_OPEN_IN_NEW_TAB]: false });
      }
    });
  }

  SettingsManager.prototype.initBookmarkManagementTab = function() {
    const tabButton = document.querySelector('[data-tab="bookmark-management"]');
    if (tabButton) {
      tabButton.addEventListener('click', () => {
        this.switchTab('bookmark-management');
      });
    }
  }

  SettingsManager.prototype.initWheelSwitchingTab = function() {
    const tabButton = document.querySelector('[data-tab="wheel-switching"]');
    if (tabButton) {
      tabButton.addEventListener('click', () => {
        this.switchTab('wheel-switching');
      });
    }
    
    // 加载保存的设置
    chrome.storage.sync.get({ enableWheelSwitching: false }, (result) => {
      if (this.enableWheelSwitchingCheckbox) {
        this.enableWheelSwitchingCheckbox.checked = result.enableWheelSwitching;
        
        // 添加事件监听器
        this.enableWheelSwitchingCheckbox.addEventListener('change', () => {
          const isEnabled = this.enableWheelSwitchingCheckbox.checked;
          chrome.storage.sync.set({ enableWheelSwitching: isEnabled });
          
          // 触发自定义事件，通知滚轮切换状态变化
          document.dispatchEvent(new CustomEvent('wheelSwitchingChanged', {
            detail: { enabled: isEnabled }
          }));
        });
      }
    });
  }

  // 添加 debounce 方法来优化性能
  SettingsManager.prototype.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
