import { getMainOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';
import { getColors, applyColors } from '../color-utils.js';
import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
function createFolderCard(folder, index) {
  if (typeof S.createFolderCard === 'function') {
    return S.createFolderCard(folder, index);
  }

  const card = document.createElement('div');
  card.className = 'bookmark-folder card';
  card.dataset.id = folder.id;
  card.dataset.parentId = folder.parentId;
  card.dataset.index = index.toString();

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = folder.title || '';
  card.appendChild(title);

  card.addEventListener('click', () => {
    if (typeof S.updateBookmarksDisplay === 'function') {
      S.updateBookmarksDisplay(folder.id);
    }
    if (typeof S.updateFolderName === 'function') {
      S.updateFolderName(folder.id);
    }
  });

  return card;
}
function displayBookmarks(bookmark) {
  const bookmarksList = document.getElementById('bookmarks-list');
  const bookmarksContainer = document.querySelector('.bookmarks-container');
  if (!bookmarksList) {
    return;
  }

  // 先移除 loaded 类
  bookmarksContainer.classList.remove('loaded');
  
  const fragment = document.createDocumentFragment();
  
  let itemsToDisplay = bookmark.children || [];
  
  itemsToDisplay.sort((a, b) => a.index - b.index);
  
  itemsToDisplay.forEach((child) => {
    if (child.url) {
      const card = createBookmarkCard(child, child.index);
      fragment.appendChild(card);
    } else {
      const folderCard = createFolderCard(child, child.index);
      fragment.appendChild(folderCard);
    }
  });
  
  bookmarksList.innerHTML = '';
  bookmarksList.appendChild(fragment);
  bookmarksList.dataset.parentId = bookmark.id;
  
  // 使用 requestAnimationFrame 确保在下一帧添加 loaded 类
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bookmarksContainer.classList.add('loaded');
    });
  });
  
  if (typeof S.setupSortable === 'function') {
    S.setupSortable();
  }
}

// 修改创建书签卡片时的颜色处理
function createBookmarkCard(bookmark, index) {
  const card = document.createElement('a');
  card.href = bookmark.url;
  card.className = 'bookmark-card card';
  card.dataset.id = bookmark.id;
  card.dataset.parentId = bookmark.parentId;
  card.dataset.index = index.toString();

  const img = document.createElement('img');
  img.className = 'w-6 h-6 mr-2';
  img.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bookmark.url)}&size=32`;

  // 尝试从缓存获取颜色
  const cachedColors = localStorage.getItem(`bookmark-colors-${bookmark.id}`);
  
  if (cachedColors) {
    // 如果有缓存，直接应用缓存的颜色
    const colors = JSON.parse(cachedColors);
    applyColors(card, colors);
    
    // 只加载 favicon 图片，不重新计算颜色
    img.onload = null;
  } else {
    // 只在没有缓存时计算颜色
    img.onload = function() {
      const colors = getColors(img);
      applyColors(card, colors);
      localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(colors));
    };
  }

  img.onerror = function() {
    // 处 favicon 加载失败的情况
    const defaultColors = { primary: [200, 200, 200], secondary: [220, 220, 220] };
    applyColors(card, defaultColors);
    localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(defaultColors));
  };

  const favicon = document.createElement('div');
  favicon.className = 'favicon';
  favicon.appendChild(img);
  card.appendChild(favicon);

  const content = document.createElement('div');
  content.className = 'card-content';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = bookmark.title;

  content.appendChild(title);
  card.appendChild(content);

  card.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    event.stopPropagation(); // 阻止事件冒泡，防止触发文档级的contextmenu事件监听器
    console.log('Bookmark context menu triggered:', bookmark);
    S.showContextMenu(event, bookmark, 'bookmark'); // 明确指定类型为 'bookmark'
  });

  // 添加鼠标悬停效果
  card.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.03)';
    this.style.boxShadow = '0 1px 1px rgba(0,0,0,0.01)';
    this.style.backgroundColor = 'rgba(255,255,255,1)';
  });

  card.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '';
    this.style.backgroundColor = '';
  });

  // 在文件顶部添加防重复点击控制
  let isProcessingClick = false;
  const CLICK_COOLDOWN = 500; // 点击冷却时间

  // 只使用一个事件处理器
  card.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessingClick) return;
    isProcessingClick = true;

    try {
      // 通过页面文件名判断环境
      const isSidePanel = window.location.pathname.endsWith('sidepanel.html');
      const isInternalUrl = bookmark.url.startsWith('chrome://') || 
                           bookmark.url.startsWith('chrome-extension://') ||
                           bookmark.url.startsWith('edge://') ||
                           bookmark.url.startsWith('about:');

      console.log('[Bookmark Click] Starting...', {
        url: bookmark.url,
        isInternalUrl: isInternalUrl,
        isSidePanel: isSidePanel
      });

      // 处理内部链接
      if (isInternalUrl) {
        console.log('[Bookmark Click] Opening internal URL');
        chrome.tabs.create({
          url: bookmark.url,
          active: true
        }).then(tab => {
          console.log('[Bookmark Click] Internal tab created successfully:', tab);
        }).catch(error => {
          console.error('[Bookmark Click] Failed to create internal tab:', error);
        });
        return;
      }

      // 处理普通链接
      if (isSidePanel) {
        console.log('[Bookmark Click] Opening in Side Panel mode');
        const { openInNewTab, openInSidepanel } = await getSidepanelOpenMode();
          
        console.log('[Bookmark Click] Side Panel settings:', {
          openInNewTab: openInNewTab,
          openInSidepanel: openInSidepanel
        });
          
        if (openInSidepanel) {
            // 在侧边栏内打开链接
            console.log('[Bookmark Click] Opening in Side Panel iframe');
            // 使用 SidePanelManager 加载 URL
            try {
              // 检查 SidePanelManager 是否已定义
              if (typeof SidePanelManager === 'undefined') {
                // 如果未定义，则创建一个简单的加载函数
                console.log('[Bookmark Click] SidePanelManager not defined, using fallback method');
                const sidePanelContent = document.getElementById('side-panel-content');
                const sidePanelIframe = document.getElementById('side-panel-iframe');
                
                if (sidePanelContent && sidePanelIframe) {
                  sidePanelContent.style.display = 'block';
                  sidePanelIframe.src = bookmark.url;
                  
                  // 添加返回按钮
                  let backButton = document.querySelector('.back-to-links');
                  if (!backButton) {
                    backButton = document.createElement('div');
                    backButton.className = 'back-to-links';
                    backButton.innerHTML = '<span class="material-icons">arrow_back</span>';
                    document.body.appendChild(backButton);
                    
                    // 添加点击事件
                    backButton.addEventListener('click', () => {
                      sidePanelContent.style.display = 'none';
                      backButton.style.display = 'none';
                    });
                  }
                  
                  // 显示返回按钮
                  backButton.style.display = 'flex';
                } else {
                  console.error('[Bookmark Click] Side panel elements not found, falling back to new tab');
                  chrome.tabs.create({
                    url: bookmark.url,
                    active: true
                  });
                }
              } else if (window.sidePanelManager) {
                window.sidePanelManager.loadUrl(bookmark.url);
              } else {
                // 如果 SidePanelManager 已定义但实例不存在，创建一个新实例
                window.sidePanelManager = new SidePanelManager();
                window.sidePanelManager.loadUrl(bookmark.url);
              }
            } catch (error) {
              console.error('[Bookmark Click] Error using SidePanelManager:', error);
              // 出错时回退到在新标签页中打开
              chrome.tabs.create({
                url: bookmark.url,
                active: true
              });
            }
        } else if (openInNewTab) {
            // 在新标签页中打开
            chrome.tabs.create({
              url: bookmark.url,
              active: true
            }).then(tab => {
              console.log('[Bookmark Click] Tab created successfully:', tab);
            }).catch(error => {
              console.error('[Bookmark Click] Failed to create tab:', error);
            });
        }
      } else {
        console.log('[Bookmark Click] Opening in Main Window mode');
        const openInNewTab = await getMainOpenInNewTab();
        if (openInNewTab) {
          window.open(bookmark.url, '_blank');
        } else {
          window.location.href = bookmark.url;
        }
      }
    } catch (error) {
      console.error('[Bookmark Click] Error:', error);
    } finally {
      setTimeout(() => {
        isProcessingClick = false;
      }, CLICK_COOLDOWN);
    }
  });

  return card;
}


assignToScriptState({ displayBookmarks, createBookmarkCard, createFolderCard });
