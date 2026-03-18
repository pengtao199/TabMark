// 导入所需的依赖
import { ICONS, getIconHtml } from '../icons.js';

// 预定义的所有可用搜索引擎列表
const ALL_ENGINES = [
  { name: 'google', icon: '../../images/google-logo.svg', label: 'googleLabel', url: 'https://www.google.com/search?q=', aliases: ['谷歌'] },
  { name: 'bing', icon: '../../images/bing-logo.png', label: 'bingLabel', url: 'https://www.bing.com/search?q=' },
  { name: 'baidu', icon: '../../images/baidu-logo.svg', label: 'baiduLabel', url: 'https://www.baidu.com/s?wd=', aliases: ['百度'] },
  { name: 'kimi', icon: '../../images/kimi-logo.svg', label: 'kimiLabel', url: 'https://kimi.moonshot.cn/?q=', aliases: ['Kimi'] },
  { name: 'doubao', icon: '../../images/doubao-logo.png', label: 'doubaoLabel', url: 'https://www.doubao.com/?q=', aliases: ['豆包'] },
  { name: 'chatgpt', icon: '../../images/chatgpt-logo.svg', label: 'chatgptLabel', url: 'https://chat.openai.com/?q=', aliases: ['ChatGPT'] },
  { name: 'felo', icon: '../../images/felo-logo.svg', label: 'feloLabel', url: 'https://felo.ai/search?q=', aliases: ['Felo'] },
  { name: 'metaso', icon: '../../images/metaso-logo.png', label: 'metasoLabel', url: 'https://metaso.cn/?q=', aliases: ['Metaso'] },
  { name: 'perplexity', icon: '../../images/perplexity-logo.svg', label: 'perplexityLabel', url: 'https://www.perplexity.ai/?q=', aliases: ['Perplexity'] },
  { name: 'semanticscholar', icon: '../../images/semanticscholar-logo.png', label: 'semanticscholarLabel', url: 'https://www.semanticscholar.org/search?q=', aliases: ['Semantic Scholar'] },
  { name: 'deepseek', icon: '../../images/deepseek-logo.svg', label: 'deepseekLabel', url: 'https://chat.deepseek.com/?q=', aliases: ['DeepSeek'] },  
  { name: 'grok', icon: '../../images/grok-logo.svg', label: 'grokLabel', url: 'https://grok.com/?q=', aliases: ['Grok'] },
  { name: 'yahoo', icon: '../../images/yahoo-logo.svg', label: 'yahooLabel', url: 'https://search.yahoo.com/search?p=', aliases: ['雅虎'] },
  { name: 'duckduckgo', icon: '../../images/duckduckgo-logo.svg', label: 'duckduckgoLabel', url: 'https://duckduckgo.com/?q=', aliases: ['DuckDuckGo'] },
  { name: 'yandex', icon: '../../images/yandex-logo.svg', label: 'yandexLabel', url: 'https://yandex.com/search/?text=', aliases: ['Yandex'] },
  { name: 'xiaohongshu', icon: '../../images/xiaohongshu-logo.svg', label: 'xiaohongshuLabel', url: 'https://www.xiaohongshu.com/search_result?keyword=', aliases: ['小红书'] },
  { name: 'jike', icon: '../../images/jike-logo.svg', label: 'jikeLabel', url: 'https://web.okjike.com/search?keyword=', aliases: ['即刻'] },
  { name: 'zhihu', icon: '../../images/zhihu-logo.svg', label: 'zhihuLabel', url: 'https://www.zhihu.com/search?q=', aliases: ['知乎'] },
  { name: 'douban', icon: '../../images/douban-logo.svg', label: 'doubanLabel', url: 'https://www.douban.com/search?q=', aliases: ['豆瓣'] },
  { name: 'bilibili', icon: '../../images/bilibili-logo.svg', label: 'bilibiliLabel', url: 'https://search.bilibili.com/all?keyword=', aliases: ['Bilibili'] },
  { name: 'github', icon: '../../images/github-logo.svg', label: 'githubLabel', url: 'https://github.com/search?q=', aliases: ['GitHub'] }
];

// 定义搜索引擎分类
const ENGINE_CATEGORIES = {
  AI: ['kimi', 'doubao', 'chatgpt', 'perplexity', 'claude', 'felo', 'metaso', 'semanticscholar', 'deepseek', 'grok'],
  SEARCH: ['google', 'bing', 'baidu', 'duckduckgo', 'yahoo', 'yandex'],
  SOCIAL: ['xiaohongshu', 'jike', 'zhihu', 'douban', 'bilibili', 'github']
};

// 存储管理相关函数
const SearchEngineManager = {
  // 获取用户启用的搜索引擎列表
  getEnabledEngines() {
    const stored = localStorage.getItem('enabledSearchEngines');
    if (stored) {
      return JSON.parse(stored);
    }
    // 默认启用前6个搜索引擎
    const defaultEngines = ALL_ENGINES.slice(0, 8);
    this.saveEnabledEngines(defaultEngines);
    return defaultEngines;
  },

  // 保存启用的搜索引擎列表
  saveEnabledEngines(engines) {
    localStorage.setItem('enabledSearchEngines', JSON.stringify(engines));
  },

  // 获取所有可用的搜索引擎列表
  getAllEngines() {
    // 合并预定义和自定义搜索引擎
    const customEngines = getCustomEngines();
    return [...ALL_ENGINES, ...customEngines];
  },

  // 添加搜索引擎到启用列表
  addEngine(engineName) {
    const enabled = this.getEnabledEngines();
    const engine = this.getAllEngines().find(e => e.name === engineName);
    if (engine && !enabled.find(e => e.name === engineName)) {
      enabled.push(engine);
      this.saveEnabledEngines(enabled);
      return true;
    }
    return false;
  },

  // 从启用列表中移除搜索引擎
  removeEngine(engineName) {
    const enabled = this.getEnabledEngines();
    const filtered = enabled.filter(e => e.name !== engineName);
    if (filtered.length < enabled.length) {
      this.saveEnabledEngines(filtered);
      return true;
    }
    return false;
  },

  // 获取默认搜索引擎
  getDefaultEngine() {
    const defaultEngineName = localStorage.getItem('selectedSearchEngine');
    console.log('[Search] Getting default engine, stored name:', defaultEngineName);
    
    if (defaultEngineName) {
      const allEngines = this.getAllEngines();
      const engine = allEngines.find(e => e.name === defaultEngineName);
      if (engine) {
        console.log('[Search] Found engine config:', engine);
        return engine;
      }
    }
    console.log('[Search] Using fallback engine (Google)');
    return ALL_ENGINES[0]; // 默认返回 Google
  },

  // 设置默认搜索引擎
  setDefaultEngine(engineName) {
    const allEngines = this.getAllEngines();
    const engine = allEngines.find(e => e.name === engineName);
    
    if (engine) {
      console.log('[Search] Setting default engine to:', engine);
      localStorage.setItem('selectedSearchEngine', engineName);
      return true;
    }
    console.error('[Search] Engine not found:', engineName);
    return false;
  }
};


function getCustomEngines() {
  const stored = localStorage.getItem('customSearchEngines');
  return stored ? JSON.parse(stored) : [];
}

export {
  ALL_ENGINES,
  ENGINE_CATEGORIES,
  SearchEngineManager,
  getCustomEngines
};
