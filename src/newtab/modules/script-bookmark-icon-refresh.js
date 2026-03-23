import { getScriptState, assignToScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const ICON_OVERRIDE_KEY_PREFIX = 'bookmark-icon-override-';
const ORIGIN_ICON_CACHE_KEY_PREFIX = 'origin-icon-cache-';
const ORIGIN_ICON_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;
const ICON_CACHE_DB_NAME = 'tabmark-icon-cache';
const ICON_CACHE_DB_VERSION = 1;
const ICON_CACHE_STORE = 'origin-icons';
let iconCacheDbPromise = null;
const originObjectUrlCache = new Map();

function buildChromeFaviconUrl(pageUrl, size = 32, bustCache = false) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  url.searchParams.set('cache', '1');
  if (bustCache) {
    url.searchParams.set('t', String(Date.now()));
  }
  return url.toString();
}

function buildGoogleS2Url(pageUrl, size = 64) {
  const domain = new URL(pageUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

function getIconOverrideStorageKey(bookmarkId) {
  return `${ICON_OVERRIDE_KEY_PREFIX}${bookmarkId}`;
}

function getOriginCacheStorageKey(origin) {
  return `${ORIGIN_ICON_CACHE_KEY_PREFIX}${origin}`;
}

function readJSONFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to parse stored JSON:', key, error);
    return null;
  }
}

function writeJSONToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to persist JSON:', key, error);
  }
}

function getBookmarkIconOverride(bookmarkId) {
  if (!bookmarkId) {
    return null;
  }

  return readJSONFromStorage(getIconOverrideStorageKey(bookmarkId));
}

function setBookmarkIconOverride(bookmarkId, value) {
  if (!bookmarkId) {
    return;
  }

  writeJSONToStorage(getIconOverrideStorageKey(bookmarkId), value);
}

function getCachedOriginIcon(origin) {
  const cached = readJSONFromStorage(getOriginCacheStorageKey(origin));
  if (!cached?.src || !cached.timestamp) {
    return null;
  }

  if (typeof cached.src === 'string' && cached.src.startsWith('blob:')) {
    return null;
  }

  if ((Date.now() - cached.timestamp) > ORIGIN_ICON_CACHE_TTL) {
    return null;
  }

  return cached;
}

function setCachedOriginIcon(origin, payload) {
  if (!origin || !payload?.src) {
    return;
  }

  writeJSONToStorage(getOriginCacheStorageKey(origin), {
    ...payload,
    timestamp: Date.now()
  });
}

function getHomepageUrl(pageUrl) {
  return new URL('/', pageUrl).toString();
}

function getOriginFromPageUrl(pageUrl) {
  try {
    return new URL(pageUrl).origin;
  } catch (_error) {
    return null;
  }
}

function resolveBookmarkIconSource(bookmarkId, pageUrl) {
  const override = getBookmarkIconOverride(bookmarkId);

  if (override?.src) {
    return override.src;
  }

  try {
    const origin = new URL(pageUrl).origin;
    if (originObjectUrlCache.has(origin)) {
      return originObjectUrlCache.get(origin);
    }
    const originCache = getCachedOriginIcon(origin);
    if (originCache?.src) {
      return originCache.src;
    }
  } catch (_error) {
    // ignore invalid URL and fall back below
  }

  return buildChromeFaviconUrl(pageUrl, 32, false);
}

function parseSizesValue(sizesValue = '') {
  if (!sizesValue || typeof sizesValue !== 'string') {
    return 0;
  }

  return sizesValue
    .split(/\s+/)
    .reduce((maxValue, token) => {
      if (token === 'any') {
        return Math.max(maxValue, 1000000);
      }

      const match = token.match(/^(\d+)x(\d+)$/i);
      if (!match) {
        return maxValue;
      }

      const width = Number.parseInt(match[1], 10);
      const height = Number.parseInt(match[2], 10);
      return Math.max(maxValue, width * height);
    }, 0);
}

function normalizeIconUrl(href, baseUrl) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch (_error) {
    return null;
  }
}

function openIconCacheDb() {
  if (iconCacheDbPromise) {
    return iconCacheDbPromise;
  }

  iconCacheDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ICON_CACHE_DB_NAME, ICON_CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ICON_CACHE_STORE)) {
        db.createObjectStore(ICON_CACHE_STORE, { keyPath: 'origin' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open icon cache database'));
  }).catch((error) => {
    console.warn('Failed to open icon cache database:', error);
    iconCacheDbPromise = null;
    return null;
  });

  return iconCacheDbPromise;
}

function readOriginIconAsset(origin) {
  if (!origin) {
    return Promise.resolve(null);
  }

  return openIconCacheDb().then((db) => {
    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ICON_CACHE_STORE, 'readonly');
      const store = transaction.objectStore(ICON_CACHE_STORE);
      const request = store.get(origin);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Failed to read icon cache'));
    });
  }).catch((error) => {
    console.warn('Failed to read cached origin icon:', origin, error);
    return null;
  });
}

function writeOriginIconAsset(origin, blob, metadata = {}) {
  if (!origin || !blob) {
    return Promise.resolve();
  }

  return openIconCacheDb().then((db) => {
    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ICON_CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(ICON_CACHE_STORE);
      store.put({
        origin,
        blob,
        timestamp: Date.now(),
        contentType: metadata.contentType || blob.type || '',
        source: metadata.source || 'remote',
      });
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error || new Error('Failed to write icon cache'));
    });
  }).catch((error) => {
    console.warn('Failed to write cached origin icon:', origin, error);
    return null;
  });
}

function getObjectUrlForOrigin(origin, blob) {
  if (!origin || !blob) {
    return null;
  }

  const existing = originObjectUrlCache.get(origin);
  if (existing) {
    return existing;
  }

  const objectUrl = URL.createObjectURL(blob);
  originObjectUrlCache.set(origin, objectUrl);
  return objectUrl;
}

async function getCachedOriginIconDisplaySrc(origin) {
  if (!origin) {
    return null;
  }

  const existing = originObjectUrlCache.get(origin);
  if (existing) {
    return existing;
  }

  const record = await readOriginIconAsset(origin);
  if (!record?.blob || !record?.timestamp) {
    return null;
  }

  if ((Date.now() - record.timestamp) > ORIGIN_ICON_CACHE_TTL) {
    return null;
  }

  return getObjectUrlForOrigin(origin, record.blob);
}

function uniqueBySrc(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.src || seen.has(candidate.src)) {
      return false;
    }
    seen.add(candidate.src);
    return true;
  });
}

function collectHtmlIconCandidates(doc, baseUrl) {
  const links = Array.from(doc.querySelectorAll('link[href][rel]'));

  const candidates = links
    .map((link) => {
      const rel = (link.getAttribute('rel') || '').toLowerCase();
      const href = link.getAttribute('href') || '';
      const src = normalizeIconUrl(href, baseUrl);
      if (!src) {
        return null;
      }

      if (rel.includes('apple-touch-icon')) {
        return {
          src,
          declaredSize: parseSizesValue(link.getAttribute('sizes') || ''),
          priority: 400
        };
      }

      if (rel.includes('icon') && !rel.includes('mask-icon')) {
        return {
          src,
          declaredSize: parseSizesValue(link.getAttribute('sizes') || ''),
          priority: rel.includes('shortcut icon') ? 180 : 220
        };
      }

      return null;
    })
    .filter(Boolean);

  return uniqueBySrc(candidates);
}

function extractManifestUrl(doc, baseUrl) {
  const manifestLink = doc.querySelector('link[rel="manifest"][href]');
  if (!manifestLink) {
    return null;
  }

  return normalizeIconUrl(manifestLink.getAttribute('href'), baseUrl);
}

async function fetchText(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

async function fetchIconBlob(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch icon blob ${url}: ${response.status}`);
  }

  return response.blob();
}

async function collectManifestIconCandidates(manifestUrl) {
  if (!manifestUrl) {
    return [];
  }

  try {
    const manifest = await fetchJSON(manifestUrl);
    const icons = Array.isArray(manifest?.icons) ? manifest.icons : [];

    return uniqueBySrc(
      icons
        .map((icon) => {
          const src = normalizeIconUrl(icon?.src, manifestUrl);
          if (!src) {
            return null;
          }

          return {
            src,
            declaredSize: parseSizesValue(icon.sizes || ''),
            priority: 320
          };
        })
        .filter(Boolean)
    );
  } catch (error) {
    console.warn('Failed to fetch manifest icons:', manifestUrl, error);
    return [];
  }
}

function buildFallbackCandidates(pageUrl) {
  return [
    {
      src: buildChromeFaviconUrl(pageUrl, 128, true),
      declaredSize: 128 * 128,
      priority: 120
    },
    {
      src: buildChromeFaviconUrl(pageUrl, 64, true),
      declaredSize: 64 * 64,
      priority: 100
    },
    {
      src: buildGoogleS2Url(pageUrl, 64),
      declaredSize: 64 * 64,
      priority: 80
    }
  ];
}

function loadImageMetadata(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      const naturalWidth = img.naturalWidth || 0;
      const naturalHeight = img.naturalHeight || 0;
      resolve({
        src,
        naturalWidth,
        naturalHeight,
        measuredSize: naturalWidth * naturalHeight
      });
    };
    img.onerror = () => reject(new Error(`Failed to load icon: ${src}`));
    img.src = src;
  });
}

function pickBestIconCandidate(results) {
  return results
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.declaredSize - a.declaredSize;
    })[0] || null;
}

async function resolveSiteIconCandidate(pageUrl) {
  const homepageUrl = getHomepageUrl(pageUrl);
  const origin = new URL(homepageUrl).origin;
  const cached = getCachedOriginIcon(origin);
  const localDisplaySrc = await getCachedOriginIconDisplaySrc(origin);

  if (cached?.src || localDisplaySrc) {
    return {
      ...(cached || {}),
      src: localDisplaySrc || cached?.src,
      remoteSrc: cached?.remoteSrc || cached?.src || null,
      source: localDisplaySrc ? 'local-cache' : (cached?.source || 'site-icon'),
    };
  }

  let htmlCandidates = [];
  let manifestCandidates = [];

  try {
    const html = await fetchText(homepageUrl);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    htmlCandidates = collectHtmlIconCandidates(doc, homepageUrl);
    const manifestUrl = extractManifestUrl(doc, homepageUrl);
    manifestCandidates = await collectManifestIconCandidates(manifestUrl);
  } catch (error) {
    console.warn('Failed to fetch homepage icon metadata:', homepageUrl, error);
  }

  const fallbackCandidates = buildFallbackCandidates(homepageUrl);
  const candidates = uniqueBySrc([
    ...htmlCandidates,
    ...manifestCandidates,
    ...fallbackCandidates
  ]);

  const loadedResults = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = await loadImageMetadata(candidate.src);
    return {
      src: candidate.src,
      priority: candidate.priority,
      declaredSize: candidate.declaredSize || 0,
      measuredSize: metadata.measuredSize || 0,
      score: Math.max(candidate.declaredSize || 0, metadata.measuredSize || 0)
    };
  }));

  const successfulCandidates = loadedResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  const bestCandidate = pickBestIconCandidate(successfulCandidates);
  if (bestCandidate?.src) {
    try {
      const blob = await fetchIconBlob(bestCandidate.src);
      await writeOriginIconAsset(origin, blob, {
        contentType: blob.type || '',
        source: bestCandidate.src,
      });
      const localSrc = getObjectUrlForOrigin(origin, blob);
      setCachedOriginIcon(origin, {
        ...bestCandidate,
        src: bestCandidate.src,
        remoteSrc: bestCandidate.src,
        hasLocalAsset: true,
      });
      return {
        ...bestCandidate,
        src: localSrc || bestCandidate.src,
        remoteSrc: bestCandidate.src,
      };
    } catch (error) {
      console.warn('Failed to persist icon blob locally:', bestCandidate.src, error);
      setCachedOriginIcon(origin, {
        ...bestCandidate,
        remoteSrc: bestCandidate.src,
        hasLocalAsset: false,
      });
    }
  }

  return bestCandidate;
}

async function resolveRefreshedIconSource(bookmarkId, pageUrl) {
  const bestCandidate = await resolveSiteIconCandidate(pageUrl);
  if (!bestCandidate?.src) {
    return null;
  }

  setBookmarkIconOverride(bookmarkId, {
    src: bestCandidate.remoteSrc || bestCandidate.src,
    source: 'site-icon',
    size: bestCandidate.score || 0,
    remoteSrc: bestCandidate.remoteSrc || bestCandidate.src
  });

  return bestCandidate.src;
}

async function hydrateBookmarkIconFromLocalCache(img, pageUrl) {
  if (!img || !pageUrl) {
    return null;
  }

  const origin = getOriginFromPageUrl(pageUrl);
  if (!origin) {
    return null;
  }

  const localSrc = await getCachedOriginIconDisplaySrc(origin);
  if (!localSrc) {
    return null;
  }

  if (img.src !== localSrc) {
    img.src = localSrc;
  }

  return localSrc;
}

async function refreshVisibleBookmarkIcons() {
  const cards = Array.from(document.querySelectorAll('#bookmarks-list .bookmark-card[data-id]'));
  if (!cards.length) {
    return;
  }

  const refreshButton = document.querySelector('.breadcrumb-refresh-button');
  refreshButton?.setAttribute('disabled', 'true');
  refreshButton?.classList.add('is-refreshing');

  try {
    await Promise.allSettled(cards.map(async (card) => {
      const bookmarkId = card.dataset.id;
      const pageUrl = card.getAttribute('href');
      const img = card.querySelector('img');

      if (!bookmarkId || !pageUrl || !img) {
        return;
      }

      const nextSrc = await resolveRefreshedIconSource(bookmarkId, pageUrl);
      if (nextSrc) {
        img.src = nextSrc;
      }
    }));
  } finally {
    refreshButton?.removeAttribute('disabled');
    refreshButton?.classList.remove('is-refreshing');
  }
}

assignToScriptState({
  resolveBookmarkIconSource,
  refreshVisibleBookmarkIcons,
  hydrateBookmarkIconFromLocalCache
});
