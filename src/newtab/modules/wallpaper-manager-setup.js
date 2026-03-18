import { WallpaperManager } from './wallpaper-manager-base.js';

    // 优化预加载方法
    WallpaperManager.prototype.preloadWallpapers = function() {
        this.presetWallpapers.forEach(preset => {
            if (!this.preloadedImages.has(preset.url)) {
                const img = new Image();
                img.src = preset.url;
                this.preloadQueue.add(preset.url);
                
                img.onload = () => {
                    this.preloadedImages.set(preset.url, img);
                    this.preloadQueue.delete(preset.url);
                };
            }
        });
    }

    // 初始化壁纸状态
    WallpaperManager.prototype.initializeWallpaper = async function() {
        const savedWallpaper = localStorage.getItem('originalWallpaper');
        const useDefaultBackground = localStorage.getItem('useDefaultBackground');
        const savedBg = localStorage.getItem('selectedBackground');
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        // 清除所有选中状态
        this.clearAllActiveStates();

        if (useDefaultBackground === 'true') {
            // 如果使用纯色背景，激活对应的选项
            const bgClass = savedBg || 'gradient-background-7';
            const bgOption = document.querySelector(`.settings-bg-option[data-bg="${bgClass}"]`);
            
            if (bgOption) {
                bgOption.classList.add('active');
                this.activeOption = bgOption;
                // 在暗黑模式下保持暗色背景
                if (isDarkMode) {
                    document.documentElement.className = bgClass;
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.className = bgClass;
                }
            }
            return;
        }

        if (savedWallpaper) {
            // 如果使用壁纸，查找对应的选项（包括用户上传的壁纸）
            let wallpaperOption = document.querySelector(`.wallpaper-option[data-wallpaper-url="${savedWallpaper}"]`);
            
            // 如果找不到对应选项，可能是用户上传的壁纸
            if (!wallpaperOption) {
                // 重新加载壁纸选项
                await this.loadPresetWallpapers();
                wallpaperOption = document.querySelector(`.wallpaper-option[data-wallpaper-url="${savedWallpaper}"]`);
            }
            
            if (wallpaperOption) {
                wallpaperOption.classList.add('active');
                this.activeOption = wallpaperOption;
            }
            
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.applyWallpaper(savedWallpaper);
                    resolve();
                };
                img.onerror = resolve;
                img.src = savedWallpaper;
            });
        } else {
            // 如果没有保存的壁纸和背景，使用默认背景
            const defaultBgOption = document.querySelector('.settings-bg-option[data-bg="gradient-background-7"]');
            if (defaultBgOption) {
                defaultBgOption.classList.add('active');
                this.activeOption = defaultBgOption;
                document.documentElement.className = 'gradient-background-7';
                localStorage.setItem('useDefaultBackground', 'true');
                localStorage.setItem('selectedBackground', 'gradient-background-7');
            }
        }
    }

    // 重置壁纸
    WallpaperManager.prototype.resetWallpaper = function() {
        // 清除所有选中状态
        this.clearAllActiveStates();
        this.clearWallpaper();
        
        // 设置默认背景
        const defaultBgOption = document.querySelector('.settings-bg-option[data-bg="gradient-background-7"]');
        if (defaultBgOption) {
            defaultBgOption.classList.add('active');
            this.activeOption = defaultBgOption;
            document.documentElement.className = 'gradient-background-7';
            // 保存默认背景设置
            localStorage.setItem('useDefaultBackground', 'true');
            localStorage.setItem('selectedBackground', 'gradient-background-7');
        }
        
        // 使用本地化的成功提示
        alert(chrome.i18n.getMessage('wallpaperResetSuccess'));
    }

    // 清除壁纸样式
    WallpaperManager.prototype.clearWallpaper = function() {
        document.body.classList.remove('has-wallpaper');
        document.body.style.removeProperty('--wallpaper-image');
        document.body.style.backgroundImage = 'none';
        this.mainElement.style.backgroundImage = 'none';
    }

    // 修改应用壁纸方法
    WallpaperManager.prototype.applyWallpaper = function(url) {
        const backgroundStyle = {
            backgroundImage: `url("${url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
        };

        // 使用 requestAnimationFrame 确保样式更新在下一帧执行
        requestAnimationFrame(() => {
            document.body.classList.add('has-wallpaper');
            document.body.style.setProperty('--wallpaper-image', `url("${url}")`);
            Object.assign(this.mainElement.style, backgroundStyle);
            Object.assign(document.body.style, backgroundStyle);
            
            // 更新欢迎消息颜色
            const welcomeElement = document.getElementById('welcome-message');
            if (welcomeElement && window.WelcomeManager) {
                window.WelcomeManager.adjustTextColor(welcomeElement);
            }
        });
    }

    // 设置新壁纸
    WallpaperManager.prototype.setWallpaper = async function(url) {
        if (!url) return;

        try {
            // 如果是 Unsplash 图片，添加优化参数
            if (url.includes('images.unsplash.com')) {
                url = `${url}?q=80&w=1920&auto=format&fit=crop`;
            }

            localStorage.removeItem('useDefaultBackground');
            document.querySelectorAll('.settings-bg-option').forEach(option => {
                option.classList.remove('active');
            });
            document.documentElement.className = '';
            await this.applyAndSaveWallpaper(url);
        } catch (error) {
            console.error('设置壁纸失败:', error);
            alert('设置壁纸失败，请重试');
        }
    }

    // 修改 applyAndSaveWallpaper 方法
    WallpaperManager.prototype.applyAndSaveWallpaper = async function(dataUrl) {
        try {
            // 在保存新壁纸前，先清除所有相关的存储
            this.clearWallpaperCache();
            
            // 压缩图片数据以减少存储大小
            const compressedDataUrl = await this.compressImageForStorage(dataUrl);
            
            try {
                // 尝试保存压缩后的数据
                localStorage.setItem('originalWallpaper', compressedDataUrl);
            } catch (storageError) {
                console.warn('无法保存壁纸到本地存储，将只保存在内存中');
            }
            
            // 更新内存缓存
            if (this.wallpaperCache) {
                URL.revokeObjectURL(this.wallpaperCache.src);
                this.wallpaperCache.src = '';
            }
            this.wallpaperCache = new Image();
            this.wallpaperCache.src = dataUrl;

            // 应用壁纸
            await this.applyWallpaper(dataUrl);
        } catch (error) {
            console.error('Failed to save wallpaper:', error);
            alert('设置壁纸失败，请重试');
        }
    }
