import { SearchEngineManager, getCustomEngines } from './search-engine-dropdown-data.js';

let refreshDropdownHandler = null;

function setSearchEngineDropdownRefresher(handler) {
  refreshDropdownHandler = typeof handler === 'function' ? handler : null;
}

function refreshSearchEngineDropdown() {
  if (refreshDropdownHandler) {
    refreshDropdownHandler();
  }
}

function initCustomEngineForm() {
  const addButton = document.getElementById('add-custom-engine');
  if (!addButton) return;

  addButton.addEventListener('click', async () => {
    const nameInput = document.getElementById('custom-engine-name');
    const urlInput = document.getElementById('custom-engine-url');
    const iconInput = document.getElementById('custom-engine-icon');

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    let icon = iconInput.value.trim();

    if (!name) {
      alert(chrome.i18n.getMessage('searchEngineNameRequired'));
      return;
    }
    if (!url) {
      alert(chrome.i18n.getMessage('searchEngineUrlRequired'));
      return;
    }
    if (!url.includes('%s')) {
      alert(chrome.i18n.getMessage('searchEngineUrlInvalid'));
      return;
    }

    // 将 %s 替换为实际的查询参数占位符
    const processedUrl = url.includes('%s') ? url : `${url}${url.includes('?') ? '&' : '?'}q=%s`;

    const customEngine = {
      name: `custom_${Date.now()}`,
      label: name,
      url: processedUrl,
      icon: icon,
      isCustom: true
    };

    // 保存自定义搜索引擎
    await saveCustomEngine(customEngine);

    // 清空输入框
    nameInput.value = '';
    urlInput.value = '';
    iconInput.value = '';

    // 刷新自定义搜索引擎列表
    refreshCustomEngines();

    // 添加成功提示
    alert(chrome.i18n.getMessage('searchEngineAddSuccess'));
  });

  // 添加 URL 输入框的实时图标预览
  const urlInput = document.getElementById('custom-engine-url');
  const iconInput = document.getElementById('custom-engine-icon');
  
  urlInput.addEventListener('blur', async () => {
    const url = urlInput.value.trim();
    const nameInput = document.getElementById('custom-engine-name');
    const name = nameInput.value.trim();
    
    if (url && !iconInput.value.trim()) {
      // 显示加载动画
      const loadingIcon = document.createElement('div');
      loadingIcon.className = 'icon-loading-spinner';
      iconInput.parentNode.insertBefore(loadingIcon, iconInput.nextSibling);
      iconInput.classList.add('loading');

      try {
        const favicon = await getFavicon(url);
        iconInput.value = favicon || generateTextIcon(name || new URL(url).hostname);
      } finally {
        // 移除加载动画
        iconInput.classList.remove('loading');
        if (loadingIcon) {
          loadingIcon.remove();
        }
      }
    }
  });
}

// 修改文本图标生成函数
function generateTextIcon(name) {
  // 获取首个有效字符
  let firstChar = name.trim().charAt(0);
  
  // 如果是中文，直接使用
  // 如果是英文，转换为大写
  // 如果有空格，获取第一个单词的首字母
  if (/^[\u4e00-\u9fa5]/.test(firstChar)) {
    // 是中文字符
    firstChar = firstChar;
  } else {
    // 非中文字符，获取第一个单词并转大写
    firstChar = name.trim().split(/\s+/)[0].charAt(0).toUpperCase();
  }

  // 创建 SVG 图标
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <rect width="40" height="40" rx="8" fill="#f0f0f0"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${/^[\u4e00-\u9fa5]/.test(firstChar) ? '18' : '20'}"
        font-weight="bold"
        fill="#666"
        text-anchor="middle"
        dominant-baseline="central"
      >
        ${firstChar}
      </text>
    </svg>
  `;

  // 转换 SVG 为 data URL
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(svgBlob);
}

// 修改 getFavicon 函数
async function getFavicon(url) {
  try {
    // 尝试从多个可能的来源获取图标
    const domain = new URL(url).hostname;
    const iconSources = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://icon.horse/icon/${domain}`,
      `https://${domain}/favicon.ico`
    ];

    // 测试图标是否可用
    for (const src of iconSources) {
      try {
        const response = await fetch(src);
        if (response.ok) {
          return src;
        }
      } catch (e) {
        continue;
      }
    }
    
    // 如果所有图标源都失败，返回文本图标
    return null;
  } catch (e) {
    return null;
  }
}

// 修改 saveCustomEngine 函数
async function saveCustomEngine(engine) {
  try {
    // 如果没有提供图标，尝试获取网站图标
    if (!engine.icon) {
      const favicon = await getFavicon(engine.url);
      engine.icon = favicon || generateTextIcon(engine.label);
    }

    const customEngines = getCustomEngines();
    customEngines.push(engine);
    localStorage.setItem('customSearchEngines', JSON.stringify(customEngines));
    
    // 自动启用新添加的搜索引擎
    SearchEngineManager.addEngine(engine.name);
    // 立即更新下拉菜单
    refreshSearchEngineDropdown();
  } catch (error) {
    console.error('Error saving custom engine:', error);
    // 使用文本图标作为后备
    engine.icon = generateTextIcon(engine.label);
    const customEngines = getCustomEngines();
    customEngines.push(engine);
    localStorage.setItem('customSearchEngines', JSON.stringify(customEngines));
    // 立即更新下拉菜单
    refreshSearchEngineDropdown();
  }
}

// 获取自定义搜索引擎列表
function getCustomEngines() {
  const stored = localStorage.getItem('customSearchEngines');
  return stored ? JSON.parse(stored) : [];
}

// 修改 deleteCustomEngine 函数
function deleteCustomEngine(engineId) {
  if (confirm(chrome.i18n.getMessage('searchEngineDeleteConfirm'))) {
    const customEngines = getCustomEngines();
    const filtered = customEngines.filter(e => e.name !== engineId);
    localStorage.setItem('customSearchEngines', JSON.stringify(filtered));
    
    // 如果该引擎已启用，则从启用列表中移除
    SearchEngineManager.removeEngine(engineId);
    // 立即更新下拉菜单
    refreshSearchEngineDropdown();
    
    refreshCustomEngines();
  }
}

// 刷新自定义搜索引擎列表
function refreshCustomEngines() {
  const container = document.getElementById('custom-engines');
  if (!container) return;

  container.innerHTML = '';
  const customEngines = getCustomEngines();
  const enabledEngines = SearchEngineManager.getEnabledEngines();
  const enabledEngineNames = enabledEngines.map(e => e.name);

  customEngines.forEach(engine => {
    const engineItem = document.createElement('div');
    engineItem.className = 'search-engine-item';

    const checkboxContainer = document.createElement('label');
    checkboxContainer.className = 'custom-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabledEngineNames.includes(engine.name);

    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkmark);

    const engineInfo = document.createElement('div');
    engineInfo.className = 'search-engine-info';

    const engineIcon = document.createElement('img');
    engineIcon.src = engine.icon;
    engineIcon.alt = engine.label;
    engineIcon.className = 'search-engine-icon';

    const engineName = document.createElement('span');
    engineName.className = 'search-engine-name';
    engineName.textContent = engine.label;

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-custom-engine';
    deleteButton.innerHTML = '×';
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      deleteCustomEngine(engine.name);
    };

    engineInfo.appendChild(engineIcon);
    engineInfo.appendChild(engineName);
    engineItem.appendChild(checkboxContainer);
    engineItem.appendChild(engineInfo);
    engineItem.appendChild(deleteButton);

    // 简化事件处理逻辑
    const toggleEngine = (e) => {
      // 获取实际的复选框元素
      const checkbox = e.currentTarget.querySelector('input[type="checkbox"]');
      
      // 排除删除按钮和复选框本身的点击
      if (e.target.closest('.delete-custom-engine') || e.target === checkbox) {
        return;
      }

      // 切换复选框状态
      checkbox.checked = !checkbox.checked;
      
      // 触发change事件以同步状态
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 更新样式和状态
      e.currentTarget.classList.toggle('selected', checkbox.checked);
      handleEngineToggle(engine, checkbox.checked);
    };

    // 为整个项目添加点击事件
    engineItem.addEventListener('click', toggleEngine);
    
    // 移除复选框的点击事件阻止
    checkbox.addEventListener('change', (e) => {
      // 直接更新状态
      engineItem.classList.toggle('selected', e.target.checked);
      handleEngineToggle(engine, e.target.checked);
    });

    container.appendChild(engineItem);
  });
}


export {
  initCustomEngineForm,
  generateTextIcon,
  getFavicon,
  saveCustomEngine,
  deleteCustomEngine,
  refreshCustomEngines,
  setSearchEngineDropdownRefresher
};
