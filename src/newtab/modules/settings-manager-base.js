// 导入所需的依赖
import { ICONS } from '../icons.js';
import { STORAGE_KEYS } from '../../shared/storage-keys.js';

// 设置管理器类
class SettingsManager {
  constructor() {
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsSidebar = document.getElementById('settings-sidebar');
    this.settingsOverlay = document.getElementById('settings-overlay');
    this.settingsIcon = document.querySelector('.settings-icon a');
    this.closeButton = document.querySelector('.settings-sidebar-close');
    this.tabButtons = document.querySelectorAll('.settings-tab-button');
    this.tabContents = document.querySelectorAll('.settings-tab-content');
    this.bgOptions = document.querySelectorAll('.settings-bg-option');
    this.enableFloatingBallCheckbox = document.getElementById('enable-floating-ball');
    this.enableQuickLinksCheckbox = document.getElementById('enable-quick-links');
    this.openInNewTabCheckbox = document.getElementById('open-in-new-tab');
    
    // 侧边栏模式下的链接打开方式设置元素可能不存在于所有页面
    // 添加安全检查，避免在元素不存在时出错
    const sidepanelOpenInNewTab = document.getElementById('sidepanel-open-in-new-tab');
    const sidepanelOpenInSidepanel = document.getElementById('sidepanel-open-in-sidepanel');
    
    this.sidepanelOpenInNewTabCheckbox = sidepanelOpenInNewTab;
    this.sidepanelOpenInSidepanelCheckbox = sidepanelOpenInSidepanel;
    
    this.widthSettings = document.getElementById('floating-width-settings');
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    this.settingsModalContent = document.querySelector('.settings-modal-content');
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.enableWheelSwitchingCheckbox = document.getElementById('enable-wheel-switching');
    this.openSearchInNewTabCheckbox = document.getElementById('open-search-in-new-tab');
    globalThis.__tabmarkSettingsManager = this;
    this.init();
  }

  init() {
    this.loadSavedSettings();
    this.initEventListeners();
    this.initTheme();
    
    // 只在相关元素存在时才调用各个初始化方法
    if (this.enableQuickLinksCheckbox) {
      this.initQuickLinksSettings();
    }
    
    if (this.enableFloatingBallCheckbox) {
      this.initFloatingBallSettings();
    }
    
    if (this.openInNewTabCheckbox || this.sidepanelOpenInNewTabCheckbox || this.sidepanelOpenInSidepanelCheckbox) {
      this.initLinkOpeningSettings();
    }
    
    // 检查书签管理相关元素
    const bookmarkCleanupButton = document.getElementById('open-bookmark-cleanup');
    if (bookmarkCleanupButton) {
      this.initBookmarkManagementTab();
    }
    
    // 检查宽度设置相关元素
    if (this.widthSlider && this.widthValue) {
      this.initBookmarkWidthSettings();
    }
    
    // 检查高度设置相关元素
    const heightSlider = document.getElementById('height-slider');
    const heightValue = document.getElementById('height-value');
    if (heightSlider && heightValue) {
      this.initCardHeightSettings();
    }
    
    // 检查容器宽度设置相关元素
    const containerWidthSlider = document.getElementById('container-width-slider');
    if (containerWidthSlider) {
      this.initContainerWidthSettings();
    }
    
    // 检查布局设置相关元素
    const showSearchBoxCheckbox = document.getElementById('show-search-box');
    const showWelcomeMessageCheckbox = document.getElementById('show-welcome-message');
    const showFooterCheckbox = document.getElementById('show-footer');
    if (showSearchBoxCheckbox || showWelcomeMessageCheckbox || showFooterCheckbox) {
      this.initLayoutSettings();
    }
    
    // 检查搜索建议设置相关元素
    if (this.showHistorySuggestionsCheckbox || this.showBookmarkSuggestionsCheckbox) {
      this.initSearchSuggestionsSettings();
    }
    
    // 检查滚轮切换设置相关元素
    if (this.enableWheelSwitchingCheckbox) {
      this.initWheelSwitchingTab();
    }
    
    // 检查快捷键设置相关元素
    const configureShortcuts = document.getElementById('configure-shortcuts');
    if (configureShortcuts) {
      this.initShortcutsSettings();
    }
  }

  initEventListeners() {
    // 打开设置侧边栏
    if (this.settingsIcon) {
      this.settingsIcon.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSettingsSidebar();
      });
    }

    // 关闭设置侧边栏
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.closeSettingsSidebar();
      });
    }

    if (this.settingsOverlay) {
      this.settingsOverlay.addEventListener('click', () => {
        this.closeSettingsSidebar();
      });
    }

    // 标签切换
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // 背景颜色选择
    this.bgOptions.forEach(option => {
      option.addEventListener('click', () => this.handleBackgroundChange(option));
    });

    // 悬浮球设置
    if (this.enableFloatingBallCheckbox) {
      this.enableFloatingBallCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({
          [STORAGE_KEYS.ENABLE_FLOATING_BALL]: this.enableFloatingBallCheckbox.checked
        });
      });
    }
    
    // 添加键盘事件监听，按ESC关闭侧边栏
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsSidebar && this.settingsSidebar.classList.contains('open')) {
        this.closeSettingsSidebar();
      }
    });

    // 添加点击侧边栏外部关闭功能
    document.addEventListener('click', (e) => {
      // 如果侧边栏已打开，且点击的不是侧边栏内部元素
      if (this.settingsSidebar &&
          this.settingsSidebar.classList.contains('open') && 
          !this.settingsSidebar.contains(e.target) && 
          !(this.settingsIcon && this.settingsIcon.contains(e.target))) {
        this.closeSettingsSidebar();
      }
    });
    
    // 阻止侧边栏内部点击事件冒泡到文档
    if (this.settingsSidebar) {
      this.settingsSidebar.addEventListener('click', (e) => {
        // 如果点击的是链接，不阻止事件冒泡
        if (e.target.tagName === 'A' || e.target.closest('a')) {
          return; // 允许链接点击事件正常传播
        }
        e.stopPropagation();
      });
    }
    
    // 阻止设置图标点击事件冒泡到文档
    if (this.settingsIcon) {
      this.settingsIcon.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  // 打开设置侧边栏
  openSettingsSidebar() {
    if (this.settingsSidebar) {
      this.settingsSidebar.classList.add('open');
    }

    if (this.settingsOverlay) {
      this.settingsOverlay.classList.add('open');
    }

    document.body.style.overflow = 'hidden';
  }
  
  // 关闭设置侧边栏
  closeSettingsSidebar() {
    const wasOpen = this.settingsSidebar && this.settingsSidebar.classList.contains('open');

    if (this.settingsSidebar) {
      this.settingsSidebar.classList.remove('open');
    }

    if (this.settingsOverlay) {
      this.settingsOverlay.classList.remove('open');
    }

    document.body.style.overflow = '';

    if (wasOpen && window.WelcomeManager) {
      window.WelcomeManager.updateWelcomeMessage();
    }
  }

  switchTab(tabName) {
    // 移除所有标签的 active 类
    this.tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // 移除所有内容的 active 类
    this.tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // 添加当前标签的 active 类
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-settings`);
    
    if (selectedButton && selectedContent) {
      selectedButton.classList.add('active');
      selectedContent.classList.add('active');
      // 更新 UI 语言
      window.updateUILanguage();
      
      // 确保欢迎消息也被更新
      if (window.WelcomeManager) {
        window.WelcomeManager.updateWelcomeMessage();
      }
    }
  }
}

export { SettingsManager };
