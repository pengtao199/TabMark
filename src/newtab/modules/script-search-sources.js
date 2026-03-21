import { featureTips } from '../feature-tips.js';
import { initGestureNavigation } from '../gesture-navigation.js';
import { applyBackgroundColor } from '../theme-utils.js';
import {
  SearchEngineManager, 
  updateSearchEngineIcon,
  setSearchEngineIcon,
  createSearchEngineDropdown, 
  initializeSearchEngineDialog,
  getSearchUrl,
  createTemporarySearchTabs,
  getSearchEngineIconPath
} from '../search-engine-dropdown.js';
import { getMainOpenInNewTab, getSearchOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';
import { STORAGE_KEYS } from '../../shared/storage-keys.js';
import { ICONS } from '../icons.js';
import { ColorCache, getColors, applyColors, updateBookmarkColors } from '../color-utils.js';
import { showQrCodeModal } from '../qrcode-modal.js';
import { openInNewWindow, openInIncognito, createUtilities } from '../bookmark-actions.js';
import { setVersionNumber, updateDefaultFoldersTabsVisibility, openSettingsModal, initScrollIndicator } from '../ui-helpers.js';
import { replaceIconsWithSvg, getIconHtml } from '../icons.js';
const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
const getLocalizedMessage = S.getLocalizedMessage;
const Utilities = createUtilities(getLocalizedMessage);
  async function getRecentHistory(limit = 100, maxPerDomain = 5) {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: limit * 20 }, (historyItems) => {
        const now = Date.now();
        const domainCounts = {};
        const uniqueItems = new Map();

        const recentHistory = historyItems
          // 映射并添加额外信息
          .map(item => {
            const url = new URL(item.url);
            const domain = url.hostname;
            return {
              text: item.title,
              url: item.url,
              domain: domain,
              type: 'history',
              relevance: 1,
              timestamp: item.lastVisitTime
            };
          })
          // 按时间排序（最近的优先）
          .sort((a, b) => b.timestamp - a.timestamp)
          // 去重（基于URL和标题）并限制每个域名的数量
          .filter(item => {
            const key = `${item.url}|${item.text}`;
            if (uniqueItems.has(key)) return false;
            
            domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
            if (domainCounts[item.domain] > maxPerDomain) return false;
            
            uniqueItems.set(key, item);
            return true;
          })
          // 应用时间衰减因子
          .map(item => {
            const daysSinceLastVisit = (now - item.timestamp) / (1000 * 60 * 60 * 24);
            item.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
            return item;
          })
          // 再次排序，这次基于相关性（考虑了时间衰减）
          .sort((a, b) => b.relevance - a.relevance)
          // 限制结果数量
          .slice(0, limit);

        resolve(recentHistory);
      });
    });
  }
  // 在文件顶部定义 RELEVANCE_CONFIG
  const RELEVANCE_CONFIG = {
    titleExactMatchWeight: 6,
    urlExactMatchWeight: 1.5,
    titlePartialMatchWeight: 1.2,
    urlPartialMatchWeight: 0.3,
    timeDecayHalfLife: 60,
    fuzzyMatchThreshold: 0.6,
    fuzzyMatchWeight: 1.5,
    bookmarkRelevanceBoost: 1.2
  };
  function searchHistory(query, maxResults = 200) {
    return new Promise((resolve) => {
      const startTime = new Date().getTime() - (30 * 24 * 60 * 60 * 1000); // 搜索最近30天的历史
      chrome.history.search(
        { 
          text: query, 
          startTime: startTime,
          maxResults: maxResults 
        }, 
        (results) => {
          
          // 对历史记录进行去重
          const uniqueResults = Array.from(new Set(results.map(r => r.url)))
            .map(url => results.find(r => r.url === url));
          resolve(uniqueResults);
        }
      );
    });
  }
  // 获取搜索建议
  async function getSuggestions(query) {
    const maxHistoryResults = 200;
    const maxBookmarkResults = 50;
    const maxTotalSuggestions = 50;

    let suggestions = [{ text: query, type: 'search', relevance: Infinity }];

    // 获取设置
    const settings = await new Promise(resolve => {
      chrome.storage.sync.get(
        ['showHistorySuggestions', 'showBookmarkSuggestions'],
        resolve
      );
    });

    // 根据设置获取历史记录建议
    let historySuggestions = [];
    if (settings.showHistorySuggestions !== false) {
      const historyItems = await searchHistory(query, maxHistoryResults);
      historySuggestions = historyItems.map(item => ({
        text: item.title,
        url: item.url,
        type: 'history',
        relevance: calculateRelevance(query, item.title, item.url),
        timestamp: item.lastVisitTime
      }));
    }

    // 根据设置获取书签建议
    let bookmarkSuggestions = [];
    if (settings.showBookmarkSuggestions !== false) {
      const bookmarkItems = await new Promise(resolve => {
        chrome.bookmarks.search(query, resolve);
      });
      bookmarkSuggestions = bookmarkItems.slice(0, maxBookmarkResults).map(item => ({
        text: item.title,
        url: item.url,
        type: 'bookmark',
        relevance: calculateRelevance(query, item.title, item.url) * RELEVANCE_CONFIG.bookmarkRelevanceBoost
      }));
    }

    // 合并所有建议
    suggestions.push(
      ...historySuggestions,
      ...bookmarkSuggestions
    );

    // 对结果进行排序和去重
    const uniqueSuggestions = Array.from(new Set(suggestions.map(s => s.url)))
      .map(url => suggestions.find(s => s.url === url))
      .sort((a, b) => b.relevance - a.relevance);

    // 平衡和交替显示结果
    const balancedResults = await balanceResults(uniqueSuggestions, maxTotalSuggestions);

    return balancedResults;
  }

Object.assign(S, { getRecentHistory, searchHistory, getSuggestions });
