// 侧边栏导航通用工具
(function() {
  const namespace = window.SidePanelNavigation = window.SidePanelNavigation || {};

  namespace.showLoadingSpinner = function showLoadingSpinner(position = 'top-right') {
    let loadingIndicator = document.getElementById('side-panel-loading-indicator');

    // 如果加载指示器不存在，创建一个
    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'side-panel-loading-indicator';
      loadingIndicator.className = 'loading-indicator';

      // 创建简洁的加载动画
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      loadingIndicator.appendChild(spinner);

      document.body.appendChild(loadingIndicator);
    }

    // 清除所有可能的位置类
    loadingIndicator.classList.remove('center', 'top-center', 'bottom-right', 'nav-adjacent');

    // 添加所请求的位置类 (如果不是默认的top-right位置)
    if (position !== 'top-right') {
      loadingIndicator.classList.add(position);
    }

    // 显示加载指示器
    loadingIndicator.style.display = 'block';

    // 在页面离开或5秒后自动隐藏（以防页面加载失败）
    setTimeout(() => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }, 5000);
  };

  namespace.refreshWithNavigation = function refreshWithNavigation() {
    // 先保存当前会话标记
    sessionStorage.setItem('sidepanel_view', 'true');
    try {
      localStorage.setItem('sidepanel_view', 'true');
    } catch (e) {
      console.log('[SidePanel Navigation] localStorage not available:', e);
    }

    // 然后再刷新页面
    // 如果URL中已经有参数，添加或更新sidepanel_view参数
    if (window.location.search) {
      // 解析现有的URL参数
      const currentUrl = new URL(window.location.href);
      const searchParams = currentUrl.searchParams;

      // 设置sidepanel_view参数
      searchParams.set('sidepanel_view', 'true');

      // 更新URL并刷新
      window.location.href = currentUrl.toString();
    } else {
      // 如果没有参数，添加sidepanel_view参数
      window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }
  };

  namespace.saveDetectionResult = function saveDetectionResult(isInSidePanel) {
    // 再次检查URL参数，确保只在真正的侧边栏视图中保存状态
    const urlParams = new URLSearchParams(window.location.search);
    const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';

    if (isInSidePanel && hasSidePanelParam) {
      try {
        sessionStorage.setItem('sidepanel_view', 'true');
        localStorage.setItem('sidepanel_view', 'true');

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
          chrome.storage.session.set({ 'sidepanel_view': true });
        }
      } catch (e) {
        console.log('[SidePanel Navigation] 存储检测结果时出错:', e);
      }
    }
  };

  namespace.calculateStringSimilarity = function calculateStringSimilarity(str1, str2) {
    // 如果其中一个是空字符串，返回另一个字符串的长度
    if (str1.length === 0) return 0;
    if (str2.length === 0) return 0;

    // 如果字符串相同，相似度为1
    if (str1 === str2) return 1;

    // 简单方法：比较两个字符串中相同位置的字符数
    const minLength = Math.min(str1.length, str2.length);
    let matchCount = 0;

    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        matchCount++;
      }
    }

    // 返回相似度 (0-1之间)
    return matchCount / Math.max(str1.length, str2.length);
  };

  namespace.calculateUrlSimilarity = function calculateUrlSimilarity(url1, url2) {
    // 简化URL
    const simplifyUrl = (url) => {
      return url.replace(/^https?:\/\//, '')  // 移除协议
              .replace(/www\./, '')          // 移除www.
              .replace(/\?.*$/, '')          // 移除查询参数
              .replace(/#.*$/, '')           // 移除锚点
              .toLowerCase();                // 转小写
    };

    const simple1 = simplifyUrl(url1);
    const simple2 = simplifyUrl(url2);

    // 如果域名不同，直接认为不相似
    const domain1 = simple1.split('/')[0];
    const domain2 = simple2.split('/')[0];

    if (domain1 !== domain2) {
      return 0;
    }

    // 如果路径部分相同，高度相似
    const path1 = simple1.substring(domain1.length);
    const path2 = simple2.substring(domain2.length);

    if (path1 === path2) {
      return 1;
    }

    // 计算路径部分的相似度
    const similarity = namespace.calculateStringSimilarity(path1, path2);
    return 0.5 + (similarity * 0.5); // 域名相同至少有0.5的相似度
  };
})();
