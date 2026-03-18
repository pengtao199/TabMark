import { getScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
document.addEventListener('DOMContentLoaded', function () {

  // 在页面加载完成后立即检查 folder-name 元素
  const folderNameElement = document.getElementById('folder-name');

  // 设置一个 MutationObserver 来监视 folder-name 元素的变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
    });
  });

  if (folderNameElement) {
    observer.observe(folderNameElement, { childList: true, subtree: true });
  }

  function expandBookmarkTree(category) {
    let parent = category.parentElement;
    while (parent && parent.id !== 'categories-list') {
      if (parent.classList.contains('folder-item')) {
        const sublist = parent.nextElementSibling;
        if (sublist && sublist.tagName === 'UL') {
          sublist.style.display = 'block';
          const arrowIcon = parent.querySelector('.material-icons.ml-auto');
          if (arrowIcon) {
            arrowIcon.textContent = 'expand_less';
          }
        }
      }
      parent = parent.parentElement;
    }
  }

  function waitForFirstCategoryEdge(attemptsLeft) {
    S.waitForFirstCategory(attemptsLeft);
  }

  function findBookmarksByParentId(nodes, parentId) {
    if (!nodes) return [];
    let bookmarks = [];
    nodes.forEach(node => {
      if (node.parentId === parentId) {
        bookmarks.push(node);
      }
      if (node.children && node.children.length > 0) {
        bookmarks = bookmarks.concat(findBookmarksByParentId(node.children, parentId));
      }
    });
    return bookmarks;
  }


  function isEdgeBrowser() {
    return /Edg/.test(navigator.userAgent);
  }

  if (isEdgeBrowser()) {
    waitForFirstCategoryEdge(10);
  } else {
    S.waitForFirstCategory(10);
  }

  const toggleSidebarButton = document.getElementById('toggle-sidebar');
  const sidebarContainer = document.getElementById('sidebar-container');

  // 读保存的侧边栏状态
  const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  // 初状
  function setSidebarState(isCollapsed) {
    if (isCollapsed) {
      sidebarContainer.classList.add('collapsed');
      toggleSidebarButton.textContent = '>';
      toggleSidebarButton.style.left = '2rem'; // 收起时的位置
    } else {
      sidebarContainer.classList.remove('collapsed');
      toggleSidebarButton.textContent = '<';
      toggleSidebarButton.style.left = '14.75rem'; // 展开时的位置
    }
  }

  if (toggleSidebarButton && sidebarContainer) {
    // 应用初始状态
    setSidebarState(isSidebarCollapsed);

    // 切换侧边状态的函数
    function toggleSidebar() {
      const isCollapsed = sidebarContainer.classList.toggle('collapsed');
      setSidebarState(isCollapsed);
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    }

    // 添加点击事件监听器
    toggleSidebarButton.addEventListener('click', toggleSidebar);
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('#categories-list li')) {
      S.updateBookmarkCards();
    }
  });

  S.updateBookmarkCards();

  // 注释掉这个重复的createContextMenu函数定义，使用全局已经定义的函数
  /* function createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);
    // ... 其余函数内容 ...
  } */

  document.addEventListener('click', function () {
    // 延迟处理点击事件，让菜单项的点击事件先执行
    setTimeout(() => {
    if (S.contextMenu) {
      S.contextMenu.style.display = 'none';
        S.currentBookmark = null;
      }
      
      if (S.bookmarkFolderContextMenu) {
        S.bookmarkFolderContextMenu.style.display = 'none';
        S.currentBookmarkFolder = null;
      }
    }, 200);
  });
});
