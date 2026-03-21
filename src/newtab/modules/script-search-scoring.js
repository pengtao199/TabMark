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
  function calculateRelevance(query, title, url) {
    // 基础设置
    const weights = {
      // 1. 提高完全匹配的权重，让精确结果更容易被找到
      exactTitleMatch: 200,    // 提高标题完全匹配权重
      exactUrlMatch: 150,      // 提高 URL 完全匹配权重

      // 2. 调整开头匹配权重，因为用户通常从开头输入
      titleStartsWith: 180,    // 提高标题开头匹配权重
      urlStartsWith: 150,      // 提高 URL 开头匹配权重

      // 3. 包含匹配权重适当调，避免干扰更精确的结果
      titleIncludes: 100,
      urlIncludes: 80,

      // 4. 提高分词匹配的权重，改善多关键词搜索体验
      wordMatch: 70,           // 提高分词匹配基础权重
      partialWordMatch: 40,    // 提高部分词匹配权重

      // 5. 保持模糊匹配权重较低，作为补充
      fuzzyMatch: 30
    };

    // 数据预处理
    const lowerQuery = query.toLowerCase().trim();
    const lowerTitle = (title || '').toLowerCase().trim();
    const lowerUrl = (url || '').toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/);  // 将查询分词

    let score = 0;

    // 1. 完全匹配检查
    if (lowerTitle === lowerQuery) {
      score += weights.exactTitleMatch;
    }
    if (lowerUrl === lowerQuery) {
      score += weights.exactUrlMatch;
    }

    // 2. 开头匹配检查
    if (lowerTitle.startsWith(lowerQuery)) {
      score += weights.titleStartsWith;
    }
    if (lowerUrl.startsWith(lowerQuery)) {
      score += weights.urlStartsWith;
    }

    // 3. 包含匹配检查
    if (lowerTitle.includes(lowerQuery)) {
      score += weights.titleIncludes;
    }
    if (lowerUrl.includes(lowerQuery)) {
      score += weights.urlIncludes;
    }

    // 4. 分词匹配
    queryWords.forEach(word => {
      if (word.length > 1) {
        // 完整词匹配给予更高权重
        if (lowerTitle.includes(word)) {
          score += weights.wordMatch;
          // 词在开头给予额外加分
          if (lowerTitle.startsWith(word)) {
            score += weights.wordMatch * 0.3;
          }
        }
        if (lowerUrl.includes(word)) {
          score += weights.wordMatch * 0.6;  // URL 分词匹配权重适当提高
        }

        // 7. 添加部分词匹配逻辑
        const partialMatches = findPartialMatches(word, lowerTitle);
        if (partialMatches > 0) {
          score += weights.partialWordMatch * partialMatches * 0.5;
        }
      }
    });

    // 5. 模糊匹配（编辑距离）
    if (title) {
      const fuzzyScore = calculateFuzzyMatch(lowerQuery, lowerTitle);
      if (fuzzyScore > 0.85) {  // 提高相似度阈值
        score += weights.fuzzyMatch * Math.pow(fuzzyScore, 2); // 使用平方增加高相似度的权重
      }
    }


    // 6. 长度惩罚因子（避免过长的结果）
    const lengthPenalty = Math.max(1, Math.log2(lowerTitle.length / lowerQuery.length));
    score = score / lengthPenalty;

    // 7. 添加时间衰减因子（如果有时间戳）
    if (title && title.timestamp) {
      const daysOld = (Date.now() - title.timestamp) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-daysOld / 60);  // 延长半衰期到 60 天
      score *= (0.7 + 0.3 * timeDecay);  // 保留基础分数的 70%
    }

    return Math.round(score * 100) / 100;
  }

  // 计算模糊匹配分数
  function calculateFuzzyMatch(query, text) {
    if (query.length === 0 || text.length === 0) return 0;
    if (query === text) return 1;

    const maxLength = Math.max(query.length, text.length);
    const distance = levenshteinDistance(query, text);
    return (maxLength - distance) / maxLength;
  }
  // 辅助函数：查找部分词匹配数量
  function findPartialMatches(word, text) {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(word.substring(0, Math.ceil(word.length * 0.7)), pos)) !== -1) {
      count++;
      pos += 1;
    }
    return count;
  }

  // Levenshtein 距离计算
  function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,                   // 删除
          matrix[j - 1][i] + 1,                   // 插入
          matrix[j - 1][i - 1] + substitutionCost // 替换
        );
      }
    }
    return matrix[b.length][a.length];
  }

Object.assign(S, { calculateRelevance, calculateFuzzyMatch, findPartialMatches, levenshteinDistance });
