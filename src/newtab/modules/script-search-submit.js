import { SearchEngineManager, getSearchUrl } from '../search-engine-dropdown.js';
import { getSearchOpenInNewTab } from '../../shared/open-mode.js';

function getQuery(input) {
  return (input?.value || '').trim();
}

function openUrlWithSetting(url) {
  window.__tabmarkLastSearchUrl = url;
  return getSearchOpenInNewTab().then((openInNewTab) => {
    window.__tabmarkLastSearchOpenInNewTab = openInNewTab;
    if (openInNewTab) {
      window.open(url, '_blank');
      return;
    }
    window.location.href = url;
  });
}

async function searchWithCurrentEngine(query) {
  const engine = SearchEngineManager.getDefaultEngine();
  const engineName = engine?.name || 'google';
  const url = getSearchUrl(engineName, query);
  await openUrlWithSetting(url);
}

function searchWithAllEngines(query) {
  const enabled = SearchEngineManager.getEnabledEngines();
  const urls = enabled.map((engine) => getSearchUrl(engine.name, query));
  urls.forEach((url) => window.open(url, '_blank'));
}

function initSearchSubmit() {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.querySelector('.search-input');
  if (!searchForm || !searchInput) {
    return;
  }

  // 防止表单默认提交导致空跳转。
  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = getQuery(searchInput);
    if (!query) {
      return;
    }
    window.__tabmarkSearchSubmitTriggered = 'submit';
    await searchWithCurrentEngine(query);
  });

  // textarea 的 Enter 默认是换行，这里改成搜索；Shift+Enter 保留换行。
  searchInput.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    const query = getQuery(searchInput);
    if (!query) {
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      window.__tabmarkSearchSubmitTriggered = 'metaOrCtrlEnter';
      searchWithAllEngines(query);
      return;
    }

    window.__tabmarkSearchSubmitTriggered = 'enter';
    await searchWithCurrentEngine(query);
  });
  window.__tabmarkSearchSubmitInited = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearchSubmit, { once: true });
} else {
  initSearchSubmit();
}
