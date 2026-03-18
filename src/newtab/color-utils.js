const DEFAULT_COLORS = {
  primary: [200, 200, 200],
  secondary: [220, 220, 220]
};

export const ColorCache = {
  data: new Map(),
  maxSize: 2000,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  storageKey: 'bookmark-colors-v2',

  init() {
    try {
      const cached = localStorage.getItem(this.storageKey);
      if (!cached) return;

      const parsedData = JSON.parse(cached);
      Object.entries(parsedData).forEach(([key, value]) => {
        if (Date.now() - value.timestamp < this.maxAge) {
          this.data.set(key, value);
        }
      });
    } catch (error) {
      console.error('Error initializing color cache:', error);
      this.clear();
    }
  },

  get(bookmarkId, url) {
    const cached = this.data.get(bookmarkId);
    if (!cached) return null;

    if (cached.url !== url || Date.now() - cached.timestamp > this.maxAge) {
      this.data.delete(bookmarkId);
      return null;
    }

    return cached.colors;
  },

  set(bookmarkId, url, colors) {
    if (this.data.size >= this.maxSize) {
      this.cleanup();
    }

    this.data.set(bookmarkId, {
      colors,
      url,
      timestamp: Date.now()
    });

    this.scheduleSave();
  },

  cleanup() {
    const now = Date.now();
    const entries = Array.from(this.data.entries());

    entries.forEach(([key, value]) => {
      if (now - value.timestamp > this.maxAge) {
        this.data.delete(key);
      }
    });

    if (this.data.size >= this.maxSize) {
      const sortedEntries = Array.from(this.data.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const deleteCount = Math.floor(this.data.size * 0.2);
      sortedEntries.slice(0, deleteCount).forEach(([key]) => {
        this.data.delete(key);
      });
    }
  },

  clear() {
    this.data.clear();
    localStorage.removeItem(this.storageKey);
  },

  scheduleSave: _.debounce(function () {
    try {
      const dataToSave = Object.fromEntries(this.data);
      localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      const entries = Array.from(this.data.entries());
      entries.slice(0, Math.floor(entries.length / 2)).forEach(([key]) => {
        this.data.delete(key);
      });
      this.scheduleSave();
    }
  }, 1000)
};

export function getColors(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const colors = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;
    const rgb = `${r},${g},${b}`;
    colors[rgb] = (colors[rgb] || 0) + 1;
  }

  const sortedColors = Object.entries(colors).sort((a, b) => b[1] - a[1]);

  if (sortedColors.length === 0) {
    return DEFAULT_COLORS;
  }

  const primaryColor = sortedColors[0][0].split(',').map(Number);
  const secondaryColor = sortedColors.length > 1
    ? sortedColors[1][0].split(',').map(Number)
    : primaryColor.map((c) => Math.min(255, c + 20));

  return { primary: primaryColor, secondary: secondaryColor };
}

function adjustColor(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  let factor = 1;

  if (brightness < 128) {
    factor = 1 + (128 - brightness) / 128;
  } else if (brightness > 200) {
    factor = 1 - (brightness - 200) / 55;
  }

  return {
    r: Math.min(255, Math.round(r * factor)),
    g: Math.min(255, Math.round(g * factor)),
    b: Math.min(255, Math.round(b * factor))
  };
}

export function applyColors(card, colors) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const adjustedPrimary = adjustColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  const adjustedSecondary = adjustColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const opacity = isDark ? '0.1' : '0.06';

  card.style.background = `linear-gradient(135deg, 
    rgba(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b}, ${opacity}), 
    rgba(${adjustedSecondary.r}, ${adjustedSecondary.g}, ${adjustedSecondary.b}, ${opacity}))`;
  card.style.border = `1px solid rgba(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b}, ${isDark ? '0.1' : '0.01'})`;
}

export function updateBookmarkColors(bookmark, img, card) {
  img.onload = function () {
    const colors = getColors(img);
    applyColors(card, colors);
    ColorCache.set(bookmark.id, bookmark.url, colors);
  };

  img.onerror = function () {
    applyColors(card, DEFAULT_COLORS);
    ColorCache.set(bookmark.id, bookmark.url, DEFAULT_COLORS);
  };
}
