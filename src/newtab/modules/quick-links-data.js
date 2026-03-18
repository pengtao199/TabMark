import { faviconURL, getSiteName } from '../../shared/link-utils.js';
import { sortHistoryItems } from './quick-links-history.js';

export const MAX_DISPLAY = 10;

const SEARCH_ENGINE_DOMAINS = [
  'kimi.moonshot.cn',
  'www.doubao.com',
  'chatgpt.com',
  'felo.ai',
  'metaso.cn',
  'www.google.com',
  'cn.bing.com',
  'www.baidu.com',
  'www.sogou.com',
  'www.so.com',
  'www.360.cn',
  'chrome-extension://amkgcblhdallfcijnbmjahooalabjaao'
];

function ensureSearchEngineDomainsInBlacklist(blacklist, addToBlacklist) {
  return (async () => {
    for (const domain of SEARCH_ENGINE_DOMAINS) {
      if (!blacklist.includes(domain)) {
        await addToBlacklist(domain);
      }
    }
  })();
}

function searchHistory(startTime) {
  return new Promise((resolve) => {
    chrome.history.search(
      {
        text: '',
        startTime,
        maxResults: 1000
      },
      (historyItems) => {
        resolve(historyItems);
      }
    );
  });
}

export async function buildQuickLinks({ getFixedShortcuts, getBlacklist, addToBlacklist }) {
  const fixedShortcuts = await getFixedShortcuts();
  const fixedUrls = new Set(fixedShortcuts.map((shortcut) => shortcut.url));
  const blacklist = await getBlacklist();

  await ensureSearchEngineDomainsInBlacklist(blacklist, addToBlacklist);

  const updatedBlacklist = await getBlacklist();

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const historyItems = await searchHistory(oneMonthAgo.getTime());
  const sortedHistory = sortHistoryItems(historyItems);
  const uniqueDomains = new Set();
  const allShortcuts = [];

  fixedShortcuts.forEach((shortcut) => {
    const domain = new URL(shortcut.url).hostname;
    if (!updatedBlacklist.includes(domain)) {
      allShortcuts.push(shortcut);
      uniqueDomains.add(domain);
    }
  });

  for (const item of sortedHistory) {
    const domain = new URL(item.url).hostname;
    if (
      !fixedUrls.has(item.url) &&
      !uniqueDomains.has(domain) &&
      allShortcuts.length < MAX_DISPLAY &&
      !updatedBlacklist.includes(domain)
    ) {
      uniqueDomains.add(domain);
      allShortcuts.push({
        name: getSiteName(item.title, item.url),
        url: item.url,
        favicon: faviconURL(item.url),
        fixed: false
      });
    }
  }

  return allShortcuts;
}
