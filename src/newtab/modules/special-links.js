import { openSettingsModal } from '../ui-helpers.js';

export function setupSpecialLinks() {
  const specialLinks = document.querySelectorAll('.links-icons a, .settings-icon a');
  let isProcessingClick = false;

  specialLinks.forEach(link => {
    link.addEventListener('click', async function (e) {
      e.preventDefault();
      if (isProcessingClick) return;

      isProcessingClick = true;

      const href = this.getAttribute('href');
      let chromeUrl;
      switch (href) {
        case '#history':
          chromeUrl = 'chrome://history';
          break;
        case '#downloads':
          chromeUrl = 'chrome://downloads';
          break;
        case '#passwords':
          chromeUrl = 'chrome://settings/passwords';
          break;
        case '#extensions':
          chromeUrl = 'chrome://extensions';
          break;
        case '#settings':
          openSettingsModal();
          isProcessingClick = false;
          return;
        default:
          console.error('Unknown special link:', href);
          isProcessingClick = false;
          return;
      }

      try {
        // 直接使用 chrome.tabs.create 打开新标签页
        chrome.tabs.create({ url: chromeUrl }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to open tab:', chrome.runtime.lastError);
          }
        });
      } catch (error) {
        console.error('Error opening internal page:', error);
      } finally {
        setTimeout(() => {
          isProcessingClick = false;
        }, 1000);
      }
    });
  });
}
