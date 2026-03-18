import { SearchEngineManager, ALL_ENGINES, ENGINE_CATEGORIES } from './search-engine-dropdown-data.js';
import { getIconHtml } from '../icons.js';
import { updateSearchEngineIcon } from './search-engine-dropdown-icons.js';
import {
  initCustomEngineForm,
  refreshCustomEngines,
  setSearchEngineDropdownRefresher
} from './search-engine-dropdown-custom.js';

// 创建搜索引擎选项
function createSearchEngineOption(engine, isAddButton = false) {
  const option = document.createElement('div');
  option.className = 'search-engine-option';
  
  if (isAddButton) {
    option.innerHTML = `
      <div class="search-engine-option-content add-engine">
        ${getIconHtml('add_circle')}
        <span class="search-engine-option-label">${getLocalizedMessage('addSearchEngine')}</span>
      </div>
    `;
    option.addEventListener('click', () => {
      showSearchEnginesDialog(); // 使用新的显示对话框函数
    });
  } else {
    // 创建常规搜索引擎选项
    option.innerHTML = `
      <div class="search-engine-option-content">
        <img src="${engine.icon}" alt="${getLocalizedMessage(engine.label)}" class="search-engine-option-icon">
        <span class="search-engine-option-label">${getLocalizedMessage(engine.label)}</span>
      </div>
    `;
    option.onclick = () => handleSearchEngineSelection(engine);
  }

  return option;
}

// 处理搜索引擎选择
function handleSearchEngineSelection(engine) {
  console.log('[Search] Selecting engine:', engine);
  
  // 关闭下拉菜单
  const dropdownContainer = document.querySelector('.search-engine-dropdown');
  if (dropdownContainer) {
    dropdownContainer.style.display = 'none';
  }

  // 使用 SearchEngineManager 设置默认搜索引擎
  if (SearchEngineManager.setDefaultEngine(engine.name)) {
    console.log('[Search] Default engine set to:', engine);
    
    // 更新搜索引擎图标
    updateSearchEngineIcon(engine);

    // 更新标签栏状态
    updateTabsState(engine.name);

    // 立即更新搜索表单中的默认搜索引擎
    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
      searchForm.setAttribute('data-current-engine', engine.name);
    }

    // 触发自定义事件
    const event = new CustomEvent('defaultSearchEngineChanged', {
      detail: { engine: engine }
    });
    document.dispatchEvent(event);
  } else {
    console.error('[Search] Failed to set default engine:', engine);
  }
}

// 更新标签栏状态
function updateTabsState(engineName) {
  const defaultEngine = engineName.toLowerCase();
  const tabs = document.querySelectorAll('.tab');
  
  // 先移除所有 active 类
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // 尝试找到对应的标签并添加 active 类
  const matchingTab = Array.from(tabs).find(tab => {
    const tabEngine = tab.getAttribute('data-engine').toLowerCase();
    return tabEngine === defaultEngine;
  });

  if (matchingTab) {
    matchingTab.classList.add('active');
  }
  // 如果是自定义引擎，可能没有对应的标签，这是正常的
}

// 修改初始化函数
function initializeSearchEngine() {
  console.log('[Search] Initializing search engine');
  
  // 确保 DOM 已经加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSearchEngineUI();
    });
  } else {
    initializeSearchEngineUI();
  }
}

// 新增 UI 初始化函数
function initializeSearchEngineUI() {
  const defaultEngine = SearchEngineManager.getDefaultEngine();
  console.log('[Search] Default engine:', defaultEngine);
  
  if (defaultEngine) {
    console.log('[Search] Updating UI for engine:', defaultEngine.name);
    
    // 确保搜索表单和图标元素存在
    const searchForm = document.querySelector('.search-form');
    const searchEngineIcon = document.getElementById('search-engine-icon');
    
    if (searchForm && searchEngineIcon) {
      // 更新搜索引擎图标
      updateSearchEngineIcon(defaultEngine);
      
      // 更新标签栏状态
      updateTabsState(defaultEngine.name);
      
      // 更新搜索表单中的默认搜索引擎
      searchForm.setAttribute('data-current-engine', defaultEngine.name);
      
      // 确保图标正确加载
      if (searchEngineIcon.src !== defaultEngine.icon) {
        searchEngineIcon.src = defaultEngine.icon;
        searchEngineIcon.alt = `${getLocalizedMessage(defaultEngine.label)} Search`;
      }
      
      console.log('[Search] UI successfully updated for engine:', defaultEngine.name);
    } else {
      console.error('[Search] Required DOM elements not found');
    }
  } else {
    console.warn('[Search] No default engine found, using fallback');
  }
}

// 添加 getSearchUrl 函数
function getSearchUrl(engine, query) {
  const allEngines = SearchEngineManager.getAllEngines();
  const engineConfig = allEngines.find(e => {
    // 匹配引擎名称或别名
    return e.name.toLowerCase() === engine.toLowerCase() || 
           (e.aliases && e.aliases.some(alias => alias.toLowerCase() === engine.toLowerCase()));
  });

  if (!engineConfig) {
    // 如果找不到对应的引擎配置,使用默认引擎
    const defaultEngine = SearchEngineManager.getDefaultEngine();
    return defaultEngine.url + encodeURIComponent(query);
  }

  // 确保 URL 中包含查询参数占位符
  const url = engineConfig.url.includes('%s') ? 
    engineConfig.url.replace('%s', encodeURIComponent(query)) :
    engineConfig.url + encodeURIComponent(query);

  return url;
}

// 修改 createTemporarySearchTabs 函数中的点击事件处理
function createTemporarySearchTabs() {
  const tabsContainer = document.getElementById('tabs-container');
  if (!tabsContainer) return;

  // 保留搜索提示文本
  const searchTips = tabsContainer.querySelector('.search-tips');
  tabsContainer.innerHTML = '';
  if (searchTips) {
    tabsContainer.appendChild(searchTips);
  }

  // 获取启用的搜索引擎
  const enabledEngines = SearchEngineManager.getEnabledEngines();
  const defaultEngine = SearchEngineManager.getDefaultEngine();

  // 为每个启用的搜索引擎创建标签
  enabledEngines.forEach(engine => {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('data-engine', engine.name);
    
    if (engine.name === defaultEngine.name) {
      tab.classList.add('active');
    }

    if (engine.label) {
      const label = getLocalizedMessage(engine.label) || engine.name;
      tab.textContent = label;
    } else {
      tab.textContent = engine.name;
    }

    tab.addEventListener('click', function() {
      const searchInput = document.querySelector('.search-input');
      const searchQuery = searchInput.value.trim();
      
      if (searchQuery) {
        // 移除所有标签的激活状态
        tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // 为当前点击的标签添加激活状态
        this.classList.add('active');

        // 执行搜索
        const searchUrl = getSearchUrl(engine.name, searchQuery);
        window.open(searchUrl, '_blank');
        
        // 隐藏搜索建议
        const searchSuggestions = document.querySelector('.search-suggestions-wrapper');
        if (searchSuggestions) {
          searchSuggestions.style.display = 'none';
        }
        
        // 延迟恢复默认搜索引擎状态
        setTimeout(() => {
          const defaultEngine = SearchEngineManager.getDefaultEngine();
          tabsContainer.querySelectorAll('.tab').forEach(t => {
            if (t.getAttribute('data-engine') === defaultEngine.name) {
              t.classList.add('active');
            } else {
              t.classList.remove('active');
            }
          });
        }, 300);
      }
    });

    tabsContainer.appendChild(tab);
  });
}

// 修改 createSearchEngineDropdown 函数，添加对临时搜索标签的更新
function createSearchEngineDropdown() {
  console.log('[Search] Creating dropdown menu');
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSearchEngine();
      createDropdownUI();
      createTemporarySearchTabs();
    });
  } else {
    initializeSearchEngine();
    createDropdownUI();
    createTemporarySearchTabs();
  }
}

// 新增下拉菜单 UI 创建函数
function createDropdownUI() {
  // 将原来 createSearchEngineDropdown 中的 UI 创建代码移到这里
  const existingDropdown = document.querySelector('.search-engine-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  const searchForm = document.querySelector('.search-form');
  const iconContainer = document.querySelector('.search-icon-container');
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'search-engine-dropdown';
  dropdownContainer.style.display = 'none';

  // 创建选项容器
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'search-engine-options-container';

  // 获取启用的搜索引擎列表
  const enabledEngines = SearchEngineManager.getEnabledEngines();

  // 添加启用的搜索引擎选项
  enabledEngines.forEach(engine => {
    const option = createSearchEngineOption(engine);
    optionsContainer.appendChild(option);
  });

  // 添加"添加搜索引擎"选项
  const addOption = createSearchEngineOption(null, true);
  optionsContainer.appendChild(addOption);

  // 添加事件监听器
  iconContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdownContainer.style.display === 'block';
    dropdownContainer.style.display = isVisible ? 'none' : 'block';
  });

  // 点击其他区域时关闭下拉菜单
  document.addEventListener('click', () => {
    dropdownContainer.style.display = 'none';
  });

  dropdownContainer.appendChild(optionsContainer);
  searchForm.appendChild(dropdownContainer);
}

// 添加显示搜索引擎对话框的函数
function showSearchEnginesDialog() {
  const dialog = document.getElementById('search-engines-dialog');
  if (!dialog) return;

  // 生成搜索引擎列表
  createSearchEnginesList();

  // 显示对话框
  dialog.style.display = 'block';

  // 添加关闭按钮事件
  const closeButton = dialog.querySelector('.close-button');
  if (closeButton) {
    closeButton.onclick = () => {
      dialog.style.display = 'none';
      // 关闭对话框时也更新下拉菜单
      createSearchEngineDropdown();
    };
  }

  // 点击对话框外部关闭
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      dialog.style.display = 'none';
      // 关闭对话框时也更新下拉菜单
      createSearchEngineDropdown();
    }
  };

  // 阻止对话框内容区域的点击事件冒泡
  const modalContent = dialog.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// 修改创建搜索引擎列表函数
function createSearchEnginesList() {
  const aiContainer = document.getElementById('ai-search-engines');
  const searchContainer = document.getElementById('search-engines');
  const socialContainer = document.getElementById('social-media-engines');
  
  if (!aiContainer || !searchContainer || !socialContainer) return;

  // 清空所有容器的现有内容
  aiContainer.innerHTML = '';
  searchContainer.innerHTML = '';
  socialContainer.innerHTML = '';

  // 获取已启用的搜索引擎
  const enabledEngines = SearchEngineManager.getEnabledEngines();
  const enabledEngineNames = enabledEngines.map(e => e.name);

  // 修改创建搜索引擎项目的函数
  const createEngineItem = (engine) => {
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
    engineIcon.alt = getLocalizedMessage(engine.label);
    engineIcon.className = 'search-engine-icon';

    const engineName = document.createElement('span');
    engineName.className = 'search-engine-name';
    engineName.textContent = getLocalizedMessage(engine.label);

    engineInfo.appendChild(engineIcon);
    engineInfo.appendChild(engineName);

    engineItem.appendChild(checkboxContainer);
    engineItem.appendChild(engineInfo);

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

    return engineItem;
  };

  // 填充每个分类
  ENGINE_CATEGORIES.AI.forEach(engineName => {
    const engine = ALL_ENGINES.find(e => e.name === engineName);
    if (engine) {
      aiContainer.appendChild(createEngineItem(engine));
    }
  });

  ENGINE_CATEGORIES.SEARCH.forEach(engineName => {
    const engine = ALL_ENGINES.find(e => e.name === engineName);
    if (engine) {
      searchContainer.appendChild(createEngineItem(engine));
    }
  });

  ENGINE_CATEGORIES.SOCIAL.forEach(engineName => {
    const engine = ALL_ENGINES.find(e => e.name === engineName);
    if (engine) {
      socialContainer.appendChild(createEngineItem(engine));
    }
  });
}

// 处理搜索引擎启用/禁用
function handleEngineToggle(engine, enabled) {
  if (enabled) {
    SearchEngineManager.addEngine(engine.name);
  } else {
    SearchEngineManager.removeEngine(engine.name);
  }
  // 更新下拉菜单和临时搜索标签
  createSearchEngineDropdown();
  createTemporarySearchTabs();
}
// 创建新的初始化函数
function initializeSearchEngineDialog() {
  const dialog = document.getElementById('search-engines-dialog');
  if (dialog) {
    const closeButton = dialog.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        dialog.style.display = 'none';
      });
    }
    
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.style.display = 'none';
      }
    });

    const modalContent = dialog.querySelector('.modal-content');
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  // 初始化自定义搜索引擎表单
  initCustomEngineForm();
  // 刷新自定义搜索引擎列表
  refreshCustomEngines();
}

setSearchEngineDropdownRefresher(() => {
  createSearchEngineDropdown();
});

export {
  createSearchEngineDropdown,
  initializeSearchEngineDialog,
  getSearchUrl,
  createTemporarySearchTabs
};
