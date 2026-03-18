import { WallpaperManager } from './wallpaper-manager-base.js';

    // 添加新方法：创建壁纸选项元素
    WallpaperManager.prototype.createWallpaperOption = function(url, title, isUploaded = false) {
        const option = document.createElement('div');
        option.className = 'wallpaper-option';
        option.dataset.wallpaperUrl = url;
        option.title = title;
        option.style.backgroundImage = `url('${url}')`;

        // 如果是上传的壁纸，添加标识
        if (isUploaded) {
            const badge = document.createElement('span');
            badge.className = 'uploaded-wallpaper-badge';
            badge.textContent = chrome.i18n.getMessage('uploadedWallpaperBadge');
            option.appendChild(badge);
        }

        option.addEventListener('click', () => {
            document.querySelectorAll('.settings-bg-option').forEach(opt => {
                opt.classList.remove('active');
            });
            document.querySelectorAll('.wallpaper-option').forEach(opt => {
                opt.classList.remove('active');
            });
            option.classList.add('active');
            document.documentElement.className = '';
            this.setWallpaper(url);
        });

        return option;
    }

    // 新增：生成缩略图方法
    WallpaperManager.prototype.generateThumbnail = function(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 计算合适的缩略图尺寸
                const maxSize = 150; // 更小的缩略图尺寸
                const ratio = Math.min(maxSize / img.width, maxSize / img.height);
                const width = Math.round(img.width * ratio);
                const height = Math.round(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // 使用webp格式（如果浏览器支持）
                if (this.supportsWebP()) {
                    resolve(canvas.toDataURL('image/webp', 0.8));
                } else {
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                }
            };

            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    // 检查WebP支持
    WallpaperManager.prototype.supportsWebP = function() {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    // 添加清理缓存的方法
    WallpaperManager.prototype.clearWallpaperCache = function() {
        if (this.wallpaperCache) {
            URL.revokeObjectURL(this.wallpaperCache.src);
            this.wallpaperCache.src = '';
            this.wallpaperCache = null;
        }
        
        localStorage.removeItem('originalWallpaper');
        localStorage.removeItem('selectedWallpaper');
        localStorage.removeItem('wallpaperThumbnail');
        // 不要清除用户壁纸列表
        // localStorage.removeItem('userWallpapers');
    }

    // 添加加载在线壁纸的方法
    WallpaperManager.prototype.loadOnlineWallpapers = function() {
        const container = document.querySelector('.wallpaper-options-container');
        if (!container) return;

        this.onlineWallpapers.forEach(wallpaper => {
            const option = document.createElement('div');
            option.className = 'wallpaper-option';
            option.setAttribute('data-wallpaper-url', wallpaper.url);
            
            // 创建缩略图
            const img = document.createElement('img');
            img.src = wallpaper.thumbnail;
            img.alt = 'Online Wallpaper';
            img.className = 'wallpaper-thumbnail';
            
            option.appendChild(img);
            container.appendChild(option);

            // 添加点击事件
            option.addEventListener('click', () => {
                this.setWallpaper(wallpaper.url);
            });
        });
    }

    // 添加新方法：加载用户壁纸
    WallpaperManager.prototype.loadUserWallpapers = function() {
        try {
            const savedWallpapers = localStorage.getItem('userWallpapers');
            if (savedWallpapers) {
                this.userWallpapers = JSON.parse(savedWallpapers);
                // 验证每个壁纸的有效性
                this.userWallpapers = this.userWallpapers.filter(wallpaper => {
                    return wallpaper && wallpaper.url && typeof wallpaper.url === 'string';
                });
                // 更新localStorage
                localStorage.setItem('userWallpapers', JSON.stringify(this.userWallpapers));
            }
        } catch (error) {
            console.error('Failed to load user wallpapers:', error);
            this.userWallpapers = [];
        }
    }

    // 修改 getLocalizedMessage 方法以支持参数
    WallpaperManager.prototype.getLocalizedMessage = function(key, fallback, substitutions = []) {
        try {
            const message = chrome.i18n.getMessage(key, substitutions);
            return message || fallback;
        } catch (error) {
            console.warn(`Failed to get localized message for key: ${key}`, error);
            if (substitutions.length > 0) {
                // 如果有替换参数，手动替换fallback中的占位符
                return fallback.replace(/\$1/g, substitutions[0])
                             .replace(/\$2/g, substitutions[1]);
            }
            return fallback;
        }
    }

    // 修改显示分辨率警告的代码
    WallpaperManager.prototype.handleFileRead = function(e, file, maxSize) {
        const img = new Image();
        img.onload = () => {
            const maxResolution = this.getMaxScreenResolution();
            
            if (img.width < maxResolution.width || img.height < maxResolution.height) {
                // 传递分辨率参数
                const warning = this.getLocalizedMessage(
                    'lowResolutionWarning',
                    `图片分辨率过低，建议使用至少 ${maxResolution.width}x${maxResolution.height} 的图片以获得最佳效果`,
                    [maxResolution.width.toString(), maxResolution.height.toString()]
                );
                alert(warning);
            }

            try {
                if (file.size <= maxSize) {
                    this.setWallpaper(e.target.result);
                } else {
                    this.compressAndSetWallpaper(img, maxResolution);
                }
            } catch (error) {
                console.error('处理壁纸时出错:', error);
                alert(this.getLocalizedMessage('wallpaperSetError', '设置壁纸失败，请重试'));
            } finally {
                URL.revokeObjectURL(img.src);
            }
        };
        img.onerror = () => {
            alert(this.getLocalizedMessage('imageLoadError', '图片加载失败，请尝试其他图片'));
            URL.revokeObjectURL(img.src);
        };
        img.src = e.target.result;
    }

    // 初始化必应壁纸
    WallpaperManager.prototype.initBingWallpapers = async function() {
        try {
            // 获取8天的必应壁纸
            const wallpapers = await this.fetchBingWallpapers(4);
            this.bingWallpapers = wallpapers;
            
            // 渲染壁纸
            this.renderBingWallpapers();
        } catch (error) {
            console.error('Failed to initialize Bing wallpapers:', error);
        }
    }

    // 获取必应壁纸
    WallpaperManager.prototype.fetchBingWallpapers = async function(count = 4) {
        try {
            // 使用中国的必应 API，添加 UHD 参数获取高清壁纸
            const response = await fetch(
                `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${count}&mkt=zh-CN&uhd=1&uhdwidth=3840&uhdheight=2160`
            );
            const data = await response.json();
            
            if (!data?.images) {
                console.error('No images data in response');
                return [];
            }

            // 使用解构赋值和箭头函数简化代码
            return data.images.map(({ url, title, copyright, startdate }) => ({
                // 使用中国的必应域名
                url: `https://cn.bing.com${url}`,
                title: title || copyright?.split('(')[0]?.trim() || 'Bing Wallpaper',
                copyright,
                date: startdate
            }));
        } catch (error) {
            console.error('Failed to fetch Bing wallpapers:', error);
            return [];
        }
    }

    // 渲染必应壁纸
    WallpaperManager.prototype.renderBingWallpapers = function() {
        const container = document.querySelector('.bing-wallpapers-grid');
        if (!container) return;
        
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        this.bingWallpapers.forEach(wallpaper => 
            fragment.appendChild(this.createBingWallpaperElement(wallpaper))
        );
        container.appendChild(fragment);
    }

    // 创建必应壁纸元素
    WallpaperManager.prototype.createBingWallpaperElement = function(wallpaper) {
        const { url, title, date } = wallpaper;
        const element = document.createElement('div');
        element.className = 'bing-wallpaper-item';
        element.setAttribute('data-wallpaper-url', url);
        element.title = title;
        element.innerHTML = `
            <div class="bing-wallpaper-thumbnail" style="background-image: url(${url})"></div>
            <div class="bing-wallpaper-info">
                <div class="bing-wallpaper-title">${title}</div>
                <div class="bing-wallpaper-date">${this.formatDate(date)}</div>
            </div>
        `;

        // 修改点击事件，使用 handleWallpaperOptionClick
        element.addEventListener('click', () => {
            this.handleWallpaperOptionClick(element);
        });

        return element;
    }

    // 格式化日期
    WallpaperManager.prototype.formatDate = function(dateStr) {
        try {
            const year = dateStr.slice(0, 4);
            const month = parseInt(dateStr.slice(4, 6));
            const day = parseInt(dateStr.slice(6, 8));
            const date = new Date(year, month - 1, day);
            return `${month}月${day}日`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateStr;
        }
    }
