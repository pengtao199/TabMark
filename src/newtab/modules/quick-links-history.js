const MAIN_PAGE_PATTERNS = {
  paths: ['/', '', '/home', '/index', '/main', '/welcome', '/start', '/default', '/dashboard', '/portal', '/explore'],
  queryParams: ['home=true', 'page=home', 'view=home'],
  localizedPaths: ['/zh', '/en', '/zh-CN', '/zh-TW', '/en-US']
};

export function isMainPageUrl(path, query) {
  if (MAIN_PAGE_PATTERNS.paths.includes(path)) {
    return true;
  }

  if (MAIN_PAGE_PATTERNS.localizedPaths.some((localePath) => path.startsWith(localePath))) {
    return true;
  }

  if (query && MAIN_PAGE_PATTERNS.queryParams.some((param) => query.includes(param))) {
    return true;
  }

  const pathSegments = path.split('/').filter(Boolean);
  if (pathSegments.length === 1 && pathSegments[0].toLowerCase().includes('home')) {
    return true;
  }

  return false;
}

export function updateDomainPageInfo(domainInfo, item) {
  const url = new URL(item.url);
  const path = url.pathname;
  const query = url.search;

  if (isMainPageUrl(path, query)) {
    if (!domainInfo.mainPage || item.lastVisitTime > domainInfo.mainPage.lastVisitTime) {
      domainInfo.mainPage = item;
    }
  } else {
    if (!domainInfo.lastSubPage || item.lastVisitTime > domainInfo.lastSubPage.lastVisitTime) {
      if (!domainInfo.subPages) {
        domainInfo.subPages = new Map();
      }

      const existingSubPage = domainInfo.subPages.get(path);
      if (existingSubPage) {
        existingSubPage.visitCount++;
        existingSubPage.lastVisitTime = Math.max(existingSubPage.lastVisitTime, item.lastVisitTime);
      } else {
        domainInfo.subPages.set(path, {
          item,
          visitCount: 1,
          lastVisitTime: item.lastVisitTime
        });
      }

      domainInfo.lastSubPage = item;
    }
  }

  return domainInfo;
}

export function sortHistoryItems(items) {
  const now = Date.now();
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const MONTH_IN_MS = 30 * DAY_IN_MS;
  const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
  const domainVisits = new Map();

  items.forEach((item) => {
    const url = new URL(item.url);
    const domain = url.hostname;

    if (!domainVisits.has(domain)) {
      domainVisits.set(domain, {
        totalCount: 0,
        lastVisit: 0,
        mainPage: null,
        lastSubPage: null,
        subPages: new Map()
      });
    }

    const domainInfo = domainVisits.get(domain);
    domainInfo.totalCount += 1;

    if (item.lastVisitTime > domainInfo.lastVisit) {
      domainInfo.lastVisit = item.lastVisitTime;
    }

    updateDomainPageInfo(domainInfo, item);
  });

  return Array.from(domainVisits.entries())
    .map(([domain, info]) => {
      const representativeItem = info.mainPage || info.lastSubPage;

      if (!representativeItem) {
        return null;
      }

      return {
        domain,
        url: representativeItem.url,
        title: representativeItem.title,
        lastVisitTime: info.lastVisit,
        visitCount: info.totalCount
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => {
      const recencyScoreA = Math.exp(-(now - a.lastVisitTime) / WEEK_IN_MS);
      const recencyScoreB = Math.exp(-(now - b.lastVisitTime) / WEEK_IN_MS);
      const frequencyScoreA = Math.log(a.visitCount + 1);
      const frequencyScoreB = Math.log(b.visitCount + 1);
      const scoreA = recencyScoreA * 0.45 + frequencyScoreA * 0.55;
      const scoreB = recencyScoreB * 0.45 + frequencyScoreB * 0.55;
      return scoreB - scoreA;
    });
}
