import { WallpaperManager } from './wallpaper-manager-base.js';
import './wallpaper-manager-setup.js';
import './wallpaper-manager-processing.js';
import './wallpaper-manager-bing.js';

const bootWallpaperManager = () => {
    // 检查 WelcomeManager 是否已经加载
    if (!window.WelcomeManager) {
        console.error('WelcomeManager not found. Make sure welcome.js is loaded before wallpaper.js');
    }
    new WallpaperManager();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWallpaperManager, { once: true });
}

if (document.readyState !== 'loading') {
    bootWallpaperManager();
}

function optimizeMemoryUsage(img) {
    // 在压缩完成后释放原始图片内存
    const url = img.src;
    img.onload = null;
    img.src = '';
    URL.revokeObjectURL(url);
}
