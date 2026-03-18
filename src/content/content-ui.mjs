const SEARCH_ENGINES = [
  {
    key: 'google',
    label: 'Google',
    shortcut: '1',
    url: 'https://www.google.com/search?q=',
    icon: '../images/google-logo.svg',
    alt: 'Google',
    selectedValue: 'google',
  },
  {
    key: 'bing',
    label: 'Bing',
    shortcut: '2',
    url: 'https://www.bing.com/search?q=',
    icon: '../images/bing-logo.png',
    alt: 'Bing',
    selectedValue: 'bing',
  },
  {
    key: 'baidu',
    label: '百度',
    shortcut: '3',
    url: 'https://www.baidu.com/s?wd=',
    icon: '../images/baidu-logo.svg',
    alt: 'Baidu',
    selectedValue: 'baidu',
  },
  {
    key: 'kimi',
    label: 'Kimi',
    shortcut: '4',
    url: 'https://kimi.moonshot.cn/?q=',
    icon: '../images/kimi-logo.svg',
    alt: 'Kimi',
    selectedValue: 'kimi',
  },
  {
    key: 'felo',
    label: 'Felo',
    shortcut: '5',
    url: 'https://felo.ai/search?q=',
    icon: '../images/felo-logo.svg',
    alt: 'Felo',
    selectedValue: 'felo',
  },
  {
    key: 'metaso',
    label: 'Metaso',
    shortcut: '6',
    url: 'https://metaso.cn/?q=',
    icon: '../images/sider-icon/metaso-logo.png',
    alt: 'Metaso',
    selectedValue: 'metaso',
  },
  {
    key: 'doubao',
    label: '豆包',
    shortcut: '7',
    url: 'https://www.doubao.com/chat/?q=',
    icon: '../images/sider-icon/doubao-logo.png',
    alt: 'Doubao',
    selectedValue: 'doubao',
  },
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    shortcut: '8',
    url: 'https://chatgpt.com/?q=',
    icon: '../images/sider-icon/chatgpt-logo.svg',
    alt: 'ChatGPT',
    selectedValue: 'ChatGPT',
  },
  {
    key: 'grok',
    label: 'Grok',
    shortcut: '9',
    url: 'https://grok.com/?q=',
    icon: '../images/grok-logo.svg',
    alt: 'Grok',
    selectedValue: 'grok',
  },
];

export function createFloatingButtonMarkup({
  iconUrl,
  clickTip,
  clickDesc,
  altClickTip,
  altClickDesc,
  shortcutTip,
  shortcutDesc,
  closeTitle,
}) {
  return `
    <img src="${iconUrl}" alt="icon" class="floating-button-icon">
    <div class="floating-tooltip">
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-action">${clickTip}</span>
          <span class="tooltip-desc">${clickDesc}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-action">${altClickTip}</span>
          <span class="tooltip-desc">${altClickDesc}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-action">${shortcutTip}</span>
          <span class="tooltip-desc">${shortcutDesc}</span>
        </div>
      </div>
      <button class="tooltip-close" title="${closeTitle}">
        <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
          <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
        </svg>
      </button>
    </div>
  `;
}

export function createSearchSwitcherMarkup({
  defaultSearchEngine,
  runtime,
}) {
  const searchItems = SEARCH_ENGINES.map((engine) => `
    <li data-url="${engine.url}" data-shortcut="${engine.shortcut}" ${defaultSearchEngine === engine.selectedValue ? 'class="selected"' : ''}>
      <img src="${runtime.getURL(engine.icon)}" alt="${engine.alt}" class="search-icon">
      <span>${engine.label} <span class="shortcut-key">Alt+${engine.shortcut}</span></span>
    </li>
  `).join('');

  return `
    <ul>
      ${searchItems}
    </ul>
    <ul id="bookmark-list"></ul>
  `;
}

export function getContentStyles({ doNotShowAgainLabel }) {
  return `
    #sidebar-container {
      position: fixed;
      top: 0;
      right: 0;
      width: 280px;
      height: 100vh;
      background-color: #ffffff;
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease;
      transform: translateX(100%);
      z-index: 2147483647;
      padding: 8px;
    }

    #sidebar-container.collapsed {
      transform: translateX(100%);
    }

    #sidebar-container:not(.collapsed) {
      transform: translateX(0);
    }

    #floating-button {
      position: fixed;
      width: 40px;
      height: 40px;
      top: 20%;
      right: 0;
      background-color: #ffffff;
      border-radius: 20px 0 0 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483647;
      font-size: 16px;
      color: #374151;
      user-select: none;
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    img.floating-button-icon {
      width: 24px;
      margin: 0 0 0 4px !important;
    }

    #floating-button:hover {
      background-color: #e2e8f0;
      width: 60px;
    }

    aside {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      background-color: #ffffff;
      overflow: auto;
      padding: 20px 0 0px 0;
    }

    aside ul {
      list-style-type: none;
      padding: 0;
      width: 100%;
      margin: 0;
    }

    aside ul li {
      display: flex;
      position: relative;
      font-size: 14px;
      font-weight: 600;
      color: #1a202c;
      line-height: 20px;
      padding: 8px 16px;
      margin: 4px 8px !important;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      cursor: pointer;
      border-radius: 8px;
      transition: background-color 0.3s, color 0.3s;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;
    }

    aside ul li:hover {
      background-color: #f0f0f0;
      margin: 4px 8px;
      color: #4285f4;
    }

    aside ul li.selected {
      background-color: #e2e8f0;
      font-weight: bold;
      color: #4285f4;
    }

    aside ul li.selected span {
      font-weight: bold;
    }

    .search-icon {
      height: 16px;
      margin: 0px 8px 0px 0px;
    }

    .shortcut-key {
      color: #717882;
      font-size: 12px;
      margin-left: 10px;
      position: absolute;
      left: 70%;
    }

    .bookmark-item {
      display: flex;
      align-items: center;
      margin: 4px 8px !important;
      padding: 8px 16px;
      cursor: pointer;
      transition: background-color 0.3s, color 0.3s;
    }

    .bookmark-item:hover {
      background-color: #f0f0f0;
      margin: 4px 8px;
      color: #4285f4;
    }

    .bookmark-item:hover .bookmark-title {
      color: #4285f4 !important;
    }

    .bookmark-icon {
      width: 16px;
      height: 16px;
      margin: 0 8px 0 0 !important;
    }

    .bookmark-link {
      display: flex;
      align-items: center;
      width: 100%;
      text-decoration: none;
      color: inherit;
    }

    .bookmark-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none !important;
      font-size: 14px;
      font-weight: 600;
      color: #1a202c !important;
      line-height: 20px;
    }

    .bookmark-link:hover {
      text-decoration: none !important;
    }

    #bookmark-list {
      padding: 16px 0 60px 0 !important;
    }

    a.bookmark-link {
      text-decoration: none;
    }

    .hidden {
      display: none !important;
    }

    .floating-tooltip {
      position: absolute;
      right: 50px;
      top: 50%;
      transform: translateY(-50%);
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      width: 280px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;
    }

    #floating-button:hover .floating-tooltip {
      opacity: 1;
      visibility: visible;
    }

    .tooltip-content {
      font-size: 13px;
      color: #333;
      font-family: inherit;
      padding-right: 24px;
    }

    .tooltip-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 24px;
      align-items: center;
      margin: 8px 0px;
      font-family: inherit;
    }

    .tooltip-action {
      font-weight: 600;
      color: #666;
      font-family: inherit;
      white-space: nowrap;
    }

    .tooltip-desc {
      color: #666;
      font-family: inherit;
      line-height: 1.4;
    }

    .floating-tooltip:after {
      content: '';
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%) rotate(45deg);
      width: 12px;
      height: 12px;
      background: white;
      box-shadow: 3px -3px 3px rgba(0, 0, 0, 0.05);
    }

    [data-theme="dark"] .floating-tooltip {
      background: #1f2937;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    [data-theme="dark"] .tooltip-action {
      color: #e5e7eb;
    }

    [data-theme="dark"] .tooltip-desc {
      color: #9ca3af;
    }

    [data-theme="dark"] .floating-tooltip:after {
      background: #1f2937;
    }

    .tooltip-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      background: transparent;
      border-radius: 4px;
      color: #888;
      transition: all 0.2s;
    }

    .tooltip-close:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #666;
    }

    .tooltip-close svg {
      width: 16px;
      height: 16px;
    }

    .tooltip-close:hover::after {
      content: "${doNotShowAgainLabel}";
      position: absolute;
      top: -30px;
      right: 0;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
    }
  `;
}

export function getNonSelectableStyles() {
  return `
    #sidebar-container, #floating-button {
      user-select: none;
      -webkit-user-select: none;
    }

    #bookmark-list {
      user-select: none;
      -webkit-user-select: none;
    }

    .bookmark-link, .bookmark-title {
      user-select: none;
      -webkit-user-select: none;
    }

    #search-switcher {
      user-select: none;
      -webkit-user-select: none;
    }
  `;
}
