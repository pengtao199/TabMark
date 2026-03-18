import { SearchEngineManager } from './search-engine-dropdown-data.js';

// 修改 updateSearchEngineIcon 函数
function updateSearchEngineIcon(engine) {
  if (typeof engine === 'string') {
    setSearchEngineIcon(engine);
  } else if (engine && engine.name) {
    setSearchEngineIcon(engine.name);
  }
}

// 添加 setSearchEngineIcon 函数
function setSearchEngineIcon(engineName) {
  const searchEngineIcon = document.getElementById('search-engine-icon');
  if (!searchEngineIcon) return;

  const allEngines = SearchEngineManager.getAllEngines();
  const engine = allEngines.find(e => e.name === engineName);
  
  if (engine) {
    searchEngineIcon.src = engine.icon;
    searchEngineIcon.alt = `${getLocalizedMessage(engine.label)} Search`;
  } else {
    // 使用默认图标
    searchEngineIcon.src = '../../images/placeholder-icon.svg';
    searchEngineIcon.alt = 'Search';
  }
}

// Add this function if it doesn't exist
function getSearchEngineIconPath(engineName) {
  const allEngines = SearchEngineManager.getAllEngines();
  const engine = allEngines.find(e => e.name === engineName);
  return engine ? engine.icon : '../../images/placeholder-icon.svg';
}

export {
  updateSearchEngineIcon,
  setSearchEngineIcon,
  getSearchEngineIconPath
};
