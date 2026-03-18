export function faviconURL(inputUrl) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', inputUrl);
  url.searchParams.set('size', '32');
  url.searchParams.set('cache', '1');
  return url.toString();
}

export function getSiteName(title, url) {
  const MAX_WIDTH_EN = 16;
  const MAX_WIDTH_CN = 14;
  const MAX_WIDTH_MIXED = 15;

  function getVisualWidth(str) {
    return str.split('').reduce((width, char) => {
      return width + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
    }, 0);
  }

  function cleanTitle(inputTitle) {
    if (!inputTitle || typeof inputTitle !== 'string') return '';

    let normalized = inputTitle.replace(/\s*[-|·:]\s*.*$/, '');
    normalized = normalized.replace(/\s*(官方网站|首页|网|网站|官网)$/, '');

    if (normalized.length > 20) {
      const parts = normalized.split(/\s+/);
      normalized = parts.length > 1 ? parts.slice(0, 2).join(' ') : normalized.substring(0, 20);
    }

    const cleanedTitle = normalized.trim();
    if (cleanedTitle === '') {
      return normalized;
    }

    return cleanedTitle;
  }

  const cleaned = cleanTitle(title);

  if (cleaned && cleaned.trim() !== '') {
    const visualWidth = getVisualWidth(cleaned);
    const chineseCharCount = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
    const chineseRatio = chineseCharCount / cleaned.length;

    let maxWidth;
    if (chineseRatio === 0) {
      maxWidth = MAX_WIDTH_EN;
    } else if (chineseRatio === 1) {
      maxWidth = MAX_WIDTH_CN;
    } else {
      maxWidth = Math.round(MAX_WIDTH_MIXED * (1 - chineseRatio) + (MAX_WIDTH_CN * chineseRatio) / 2);
    }

    if (visualWidth > maxWidth) {
      let truncated = '';
      let currentWidth = 0;
      for (const char of cleaned) {
        const charWidth = /[\u4e00-\u9fa5]/.test(char) ? 2 : 1;
        if (currentWidth + charWidth > maxWidth) break;
        truncated += char;
        currentWidth += charWidth;
      }
      return truncated;
    }

    return cleaned;
  }

  try {
    const hostname = new URL(url).hostname;
    let name = hostname.replace(/^www\./, '').split('.')[0];
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ');
    return getVisualWidth(name) > MAX_WIDTH_EN ? name.substring(0, MAX_WIDTH_EN) : name;
  } catch (error) {
    return 'Unknown Site';
  }
}
