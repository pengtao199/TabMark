// WallpaperManager 类用于处理所有壁纸相关的操作
class WallpaperManager {
    constructor() {
        // 首先初始化所有必要的属性
        this.wallpaperOptions = document.querySelectorAll('.wallpaper-option');
        this.uploadInput = document.getElementById('upload-wallpaper');
        this.mainElement = document.querySelector('main');
        
        // 初始化预设壁纸列表
        this.initializePresetWallpapers();
        
        // 初始化预加载队列
        this.preloadQueue = new Set();
        this.preloadedImages = new Map();
        
        // 初始化用户壁纸数组
        this.userWallpapers = [];
        
        // 初始化其他属性
        this.activeOption = null;
        
        // 加载用户壁纸
        this.loadUserWallpapers();
        
        // 初始化事件监听和其他设置
        this.initializeEventListeners();
        this.initialize();
        
        // 初始化必应壁纸
        this.bingWallpapers = [];
        this.initBingWallpapers();
    }

    // 新增方法：初始化预设壁纸列表
    initializePresetWallpapers() {
        this.presetWallpapers = [
            {
                url: '../../images/wallpapers/wallpaper-1.jpg',
                title: 'Foggy Forest'
            },
            {
                url: '../../images/wallpapers/wallpaper-2.jpg',
                title: 'Mountain Lake'
            },
            {
                url: '../../images/wallpapers/wallpaper-3.jpg',
                title: 'Sunset Beach'
            },
            {
                url: '../../images/wallpapers/wallpaper-4.jpg',
                title: 'City Night'
            },
            {
                url: '../../images/wallpapers/wallpaper-5.jpg',
                title: 'Aurora'
            },
            {
                url: '../../images/wallpapers/wallpaper-6.jpg',
                title: 'Desert Dunes'
            },
            {
                url: '../../images/wallpapers/wallpaper-7.jpg',
                title: 'Mountain View'
            },
            {
                url: '../../images/wallpapers/wallpaper-8.jpg',
                title: 'Forest Lake'
            },
            {
                url: '../../images/wallpapers/wallpaper-9.jpg',
                title: 'Sunset Hills'
            },
            {
                url: '../../images/wallpapers/wallpaper-10.jpg',
                title: 'Ocean View'
            }
        ];
    }

    // 修改 loadPresetWallpapers 方法，添加错误处理
    async loadPresetWallpapers() {
        const wallpaperContainer = document.querySelector('.wallpaper-options');
        if (!wallpaperContainer) {
            console.error('Wallpaper container not found');
            return;
        }
        
        wallpaperContainer.innerHTML = '';

        // 添加预设壁纸
        if (Array.isArray(this.presetWallpapers)) {
            this.presetWallpapers.forEach(preset => {
                const option = this.createWallpaperOption(preset.url, preset.title);
                wallpaperContainer.appendChild(option);
            });
        }

        // 添加用户上传的壁纸
        if (Array.isArray(this.userWallpapers)) {
            this.userWallpapers.forEach(wallpaper => {
                const option = this.createWallpaperOption(
                    wallpaper.url,
                    chrome.i18n.getMessage('uploadedWallpaperBadge'),
                    true
                );
                wallpaperContainer.appendChild(option);
            });
        }
    }

    initialize() {
        this.preloadWallpapers();
        this.loadPresetWallpapers();
        this.initializeWallpaper().then(() => {
            document.documentElement.classList.remove('loading-wallpaper');
        });
    }

    initializeEventListeners() {
        // 初始化上传事件监听
        this.uploadInput.addEventListener('change', (event) => this.handleFileUpload(event));

        // 初始化重置按钮事件监听
        const resetButton = document.getElementById('reset-wallpaper');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetWallpaper());
        }

        // 添加图片加载错误处理
        window.addEventListener('error', (e) => this.handleImageError(e), true);

        // 添加检查缓存按钮事件监听
        const checkCacheButton = document.getElementById('check-wallpaper-cache');
        if (checkCacheButton) {
            checkCacheButton.addEventListener('click', () => this.checkWallpaperCache());
        }

        // 纯色背景选项的点击事件
        document.querySelectorAll('.settings-bg-option').forEach(option => {
            option.addEventListener('click', () => {
                this.handleBackgroundOptionClick(option);
            });
        });

        // 壁纸选项的点击事件
        document.querySelectorAll('.wallpaper-option').forEach(option => {
            option.addEventListener('click', () => {
                this.handleWallpaperOptionClick(option);
            });
        });
    }

    handleBackgroundOptionClick(option) {
        // 移除所有选项的 active 状态
        this.clearAllActiveStates();
        
        // 设置当前选项为 active
        option.classList.add('active');
        this.activeOption = option;
        
        // 应用纯色背景
        const bgClass = option.getAttribute('data-bg');
        // 检查是否为暗黑模式
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDarkMode) {
            // 在暗黑模式下保持暗色背景
            document.documentElement.className = bgClass;
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.className = bgClass;
        }
        
        // 清除壁纸
        this.clearWallpaper();
        localStorage.setItem('useDefaultBackground', 'true');
        
        // 更新欢迎消息颜色
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement && window.WelcomeManager) {
            window.WelcomeManager.adjustTextColor(welcomeElement);
        }
    }

    handleWallpaperOptionClick(option) {
        // 移除所有选项的 active 状态
        this.clearAllActiveStates();
        
        // 设置当前选项为 active
        option.classList.add('active');
        this.activeOption = option;
        
        // 应用壁纸
        const wallpaperUrl = option.getAttribute('data-wallpaper-url');
        this.setWallpaper(wallpaperUrl);
        
        // 清除纯色背景
        document.documentElement.className = '';
        localStorage.removeItem('useDefaultBackground');
    }

    clearAllActiveStates() {
        // 清除所有纯色背景选项的 active 状态
        document.querySelectorAll('.settings-bg-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // 清除所有壁纸选项的 active 状态
        document.querySelectorAll('.wallpaper-option').forEach(option => {
            option.classList.remove('active');
        });
        // 清除所有必应壁纸选项的 active 状态
        document.querySelectorAll('.bing-wallpaper-item').forEach(option => {
            option.classList.remove('active');
        });
    }
}

export { WallpaperManager };
