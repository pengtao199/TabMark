import { WallpaperManager } from './wallpaper-manager-base.js';

    // 添加新方法：压缩图片数据
    WallpaperManager.prototype.compressImageForStorage = async function(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 计算压缩后的尺寸，最大宽度1920px
                const maxWidth = 1920;
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // 使用较低的质量来减少数据大小
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 1);
                
                // 清理内存
                URL.revokeObjectURL(img.src);
                resolve(compressedDataUrl);
            };
            img.src = dataUrl;
        });
    }

    // 创建缩略图
    WallpaperManager.prototype.createThumbnail = function(dataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const thumbnailSize = { width: 200, height: 200 };

            canvas.width = thumbnailSize.width;
            canvas.height = thumbnailSize.height;
            ctx.drawImage(img, 0, 0, thumbnailSize.width, thumbnailSize.height);

            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(thumbnailDataUrl);
        };
        img.src = dataUrl;
    }

    // 处理文件上传
    WallpaperManager.prototype.handleFileUpload = function(event) {
        const file = event.target.files[0];
        if (!this.validateFile(file)) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const compressedDataUrl = await this.compressImageForStorage(e.target.result);
                
                // 保存到用户壁纸列表
                this.userWallpapers.unshift({
                    url: compressedDataUrl,
                    title: '自定义壁纸',
                    timestamp: Date.now()
                });

                // 修改限制数量，比如改为10张
                const MAX_WALLPAPERS = 1;
                if (this.userWallpapers.length > MAX_WALLPAPERS) {
                    // 删除最旧的壁纸
                    const removedWallpapers = this.userWallpapers.splice(MAX_WALLPAPERS);
                    // 清理被删除壁纸的资源
                    removedWallpapers.forEach(wallpaper => {
                        if (wallpaper.url) {
                            URL.revokeObjectURL(wallpaper.url);
                        }
                    });
                }

                // 保存到localStorage
                try {
                    localStorage.setItem('userWallpapers', JSON.stringify(this.userWallpapers));
                } catch (storageError) {
                    console.warn('Storage quota exceeded, removing oldest wallpapers');
                    // 如果存储失败，继续删除旧壁纸直到能够存储为止
                    while (this.userWallpapers.length > 1) {
                        this.userWallpapers.pop();
                        try {
                            localStorage.setItem('userWallpapers', JSON.stringify(this.userWallpapers));
                            break;
                        } catch (e) {
                            continue;
                        }
                    }
                }

                await this.loadPresetWallpapers();
                await this.setWallpaper(compressedDataUrl);
                
            } catch (error) {
                console.error('处理壁纸时出错:', error);
                alert('设置壁纸失败，请重试');
            }
        };
        reader.onerror = () => alert(chrome.i18n.getMessage('fileReadError'));
        reader.readAsDataURL(file);
        
        event.target.value = '';
    }

    // 验证上传的文件
    WallpaperManager.prototype.validateFile = function(file) {
        if (!file) return false;
        if (!file.type.startsWith('image/')) {
            alert(chrome.i18n.getMessage('pleaseUploadImage'));
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert(chrome.i18n.getMessage('imageSizeExceeded'));
            return false;
        }
        return true;
    }

    // 获取最大屏幕分辨率
    WallpaperManager.prototype.getMaxScreenResolution = function() {
        const pixelRatio = window.devicePixelRatio || 1;
        let maxWidth = window.screen.width;
        let maxHeight = window.screen.height;

        // 设置基准分辨率为1920x1080
        const baseWidth = 1920;
        const baseHeight = 1080;

        // 如果是高分屏，适当提高分辨率，但不超过2K
        if (pixelRatio > 1) {
            maxWidth = Math.min(maxWidth * pixelRatio, 2560);
            maxHeight = Math.min(maxHeight * pixelRatio, 1440);
        }

        // 返回较小的值：实际分辨率或基准分辨率
        return {
            width: Math.min(maxWidth, baseWidth),
            height: Math.min(maxHeight, baseHeight)
        };
    }

    // 计算最大文件大小
    WallpaperManager.prototype.calculateMaxFileSize = function() {
        const maxResolution = this.getMaxScreenResolution();
        const pixelCount = maxResolution.width * maxResolution.height;
        const baseSize = pixelCount * 4; // 4 bytes per pixel (RGBA)

        // 简化压缩比率
        let compressionRatio = 0.7; // 默认70%质量
        if (pixelCount > 1920 * 1080) {
            compressionRatio = 0.5; // 更高分辨率使用50%质量
        }

        // 限制最终文件大小在2MB到5MB之间
        const maxSize = Math.round(baseSize * compressionRatio);
        return Math.min(Math.max(maxSize, 2 * 1024 * 1024), 5 * 1024 * 1024);
    }

    // 压缩并设置壁纸
    WallpaperManager.prototype.compressAndSetWallpaper = function(img, maxResolution) {
        // 先生成并显示低质量预览
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        const previewWidth = Math.round(img.width * 0.1);
        const previewHeight = Math.round(img.height * 0.1);
        
        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;
        previewCtx.drawImage(img, 0, 0, previewWidth, previewHeight);
        
        // 显示模糊预览
        const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.5);
        this.setWallpaper(previewUrl);

        // 然后异步处理高质量版本
        requestAnimationFrame(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 保持图片比例
            const ratio = Math.min(
                maxResolution.width / img.width,
                maxResolution.height / img.height
            );
            
            const width = Math.round(img.width * ratio);
            const height = Math.round(img.height * ratio);

            canvas.width = width;
            canvas.height = height;

            // 使用更好的图像平滑算法
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, width, height);

            // 使用较高的压缩质量
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            this.setWallpaper(compressedDataUrl);
        });
    }

    // 处理图片加载错误
    WallpaperManager.prototype.handleImageError = function(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'IMAGE') {
            console.error('图片加载失败:', e.target.src);
            if (e.target.src !== this.defaultWallpaper) {
                this.setWallpaper(this.defaultWallpaper);
            }
        }
    }
