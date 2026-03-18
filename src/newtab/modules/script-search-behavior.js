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
import { showMovingFeedback, hideMovingFeedback, showSuccessFeedback, showErrorFeedback, setVersionNumber, updateDefaultFoldersTabsVisibility, openSettingsModal, initScrollIndicator } from '../ui-helpers.js';
import { replaceIconsWithSvg, getIconHtml } from '../icons.js';
const S = globalThis.__tabmarkScript || (globalThis.__tabmarkScript = {});
const getLocalizedMessage = S.getLocalizedMessage;
const Utilities = createUtilities(getLocalizedMessage);
  async function balanceResults(suggestions, maxResults) {
    const currentSuggestion = suggestions.filter(s => s.type === 'search');
    let bookmarks = suggestions.filter(s => s.type === 'bookmark');
    let histories = suggestions.filter(s => s.type === 'history');
    let bingSuggestions = suggestions.filter(s => s.type === 'bing_suggestion');

    // 应用时间衰减因子到历史记录
    const now = Date.now();
    histories = histories.map(h => {
      const daysSinceLastVisit = (now - h.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceLastVisit < 7) { // 如果是最近7天内的记录
        h.relevance *= 1.5; // 为最近的记录提供额外的提升
      }
      h.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
      return h;
    });

    // 为书签提供轻微的相关性提
    bookmarks = bookmarks.map(b => {
      b.relevance *= RELEVANCE_CONFIG.bookmarkRelevanceBoost;
      return b;
    });

    // 重新排序
    bookmarks.sort((a, b) => b.relevance - a.relevance);
    histories.sort((a, b) => b.relevance - a.relevance);
    bingSuggestions.sort((a, b) => b.relevance - a.relevance);

    const results = [...currentSuggestion];
    const maxEachType = Math.floor((maxResults - 1) / 4); // 现在我们有4种类型

    // 交替添加不同类型的建议
    for (let i = 0; i < maxEachType * 4; i++) {
      if (i % 4 === 0 && bookmarks.length > 0) {
        results.push(bookmarks.shift());
      } else if (i % 4 === 1 && histories.length > 0) {
        results.push(histories.shift());
      } else if (i % 4 === 2 && bingSuggestions.length > 0) {
        results.push(bingSuggestions.shift());
      } else if (histories.length > 0) {
        results.push(histories.shift());
      }
    }

    // 如果还有空间，添加剩余的最相关项
    while (results.length < maxResults && (bookmarks.length > 0 || histories.length > 0 || bingSuggestions.length > 0)) {
      if (bookmarks.length === 0) {
        if (histories.length === 0) {
          results.push(bingSuggestions.shift());
        } else if (bingSuggestions.length === 0) {
          results.push(histories.shift());
        } else {
          results.push(histories[0].relevance > bingSuggestions[0].relevance ? histories.shift() : bingSuggestions.shift());
        }
      } else if (histories.length === 0) {
        if (bookmarks.length === 0) {
          results.push(bingSuggestions.shift());
        } else if (bingSuggestions.length === 0) {
          results.push(bookmarks.shift());
        } else {
          results.push(bookmarks[0].relevance > bingSuggestions[0].relevance ? bookmarks.shift() : bingSuggestions.shift());
        }
      } else if (bingSuggestions.length === 0) {
        results.push(bookmarks[0].relevance > histories[0].relevance ? bookmarks.shift() : histories.shift());
      } else {
        const maxRelevance = Math.max(bookmarks[0].relevance, histories[0].relevance, bingSuggestions[0].relevance);
        if (maxRelevance === bookmarks[0].relevance) {
          results.push(bookmarks.shift());
        } else if (maxRelevance === histories[0].relevance) {
          results.push(histories.shift());
        } else {
          results.push(bingSuggestions.shift());
        }
      }
    }

    // 计算用户相关性
    const suggestionsWithUserRelevance = await calculateUserRelevance(results);

    // 重新排序，使用 userRelevance 而不是 relevance
    suggestionsWithUserRelevance.sort((a, b) => b.userRelevance - a.userRelevance);

    return suggestionsWithUserRelevance;
  }

  const USER_BEHAVIOR_KEY = 'userSearchBehavior';

  // 在文件顶部定义 MAX_BEHAVIOR_ENTRIES
  const MAX_BEHAVIOR_ENTRIES = 1000; // 你可以根据需要调整这个值

  // 获取用户行为数据
  async function getUserBehavior() {
    return new Promise((resolve) => {
      chrome.storage.local.get(USER_BEHAVIOR_KEY, (result) => {
        const behavior = result[USER_BEHAVIOR_KEY] || {};
        resolve(behavior); // 直接返回行为数据，不进行清理
      });
    });
  }

  // 保存用户行为数据
  async function saveUserBehavior(key, increment = 1) {
    const behavior = await getUserBehavior();
    const now = Date.now();

    if (!behavior[key]) {
      behavior[key] = { count: 0, lastUsed: now };
    }

    behavior[key].count += increment; // 增加计数
    behavior[key].lastUsed = now; // 更新最后用时间

    // 检查条目数并清理
    if (Object.keys(behavior).length > MAX_BEHAVIOR_ENTRIES) {
      const sortedEntries = Object.entries(behavior)
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed); // 按最后使用时间排序
      sortedEntries.slice(0, sortedEntries.length - MAX_BEHAVIOR_ENTRIES).forEach(([key]) => {
        delete behavior[key]; // 删除最旧的条目
      });
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [USER_BEHAVIOR_KEY]: behavior }, resolve); // 直接保存行为数据
    });
  }

  // 计算用户相关性
  async function calculateUserRelevance(suggestions) {
    const behavior = await getUserBehavior();
    const now = Date.now();

    return suggestions.map(suggestion => {
      const key = suggestion.url || suggestion.text;
      const behaviorData = behavior[key];

      if (!behaviorData) return { ...suggestion, userRelevance: suggestion.relevance };

      const daysSinceLastUse = (now - behaviorData.lastUsed) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-daysSinceLastUse / 30); // 30天的半衰期
      const behaviorScore = behaviorData.count * recencyFactor;

      return {
        ...suggestion,
        userRelevance: suggestion.relevance * (1 + behaviorScore * 0.1) // 增加最多10%的权重
      };
    });
  }

Object.assign(S, { balanceResults, getUserBehavior, saveUserBehavior, calculateUserRelevance });
