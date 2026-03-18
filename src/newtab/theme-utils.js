import { ICONS } from './icons.js';

export function applyBackgroundColor() {
    const savedBg = localStorage.getItem('selectedBackground');
    if (savedBg) {
        const useDefaultBackground = localStorage.getItem('useDefaultBackground');
        
        if (useDefaultBackground !== 'true') {
            document.querySelectorAll('.settings-bg-option').forEach(option => {
                option.classList.remove('active');
            });
            return;
        }
        
        document.documentElement.className = savedBg;
        
        // 使用 WelcomeManager 更新欢迎消息颜色
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement && window.WelcomeManager) {
            window.WelcomeManager.adjustTextColor(welcomeElement);
        }
    }
}



export function updateThemeIcon(isDark) {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (!themeToggleBtn) return;

  themeToggleBtn.innerHTML = isDark ? ICONS.dark_mode : ICONS.light_mode;
}


export function setDefaultIcon(iconElement) {
  iconElement.src = '../images/default-search-icon.png';
  iconElement.alt = 'Default Search Engine';
}
