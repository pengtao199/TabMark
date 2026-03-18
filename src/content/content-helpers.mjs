export function getSelectedText({
  windowRef = window,
  extensionContainer,
  shadow,
} = {}) {
  const selection = windowRef.getSelection();
  if (!selection) {
    return '';
  }

  const selectedText = selection.toString().trim();

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    if (
      (extensionContainer && extensionContainer.contains(container)) ||
      (shadow && shadow.contains(container))
    ) {
      return '';
    }
  }

  return selectedText;
}

export function getSearchQuery(locationSearch = window.location.search) {
  const urlParams = new URLSearchParams(locationSearch);
  return (
    urlParams.get('q') ||
    urlParams.get('p') ||
    urlParams.get('text') ||
    urlParams.get('wd') ||
    ''
  );
}

export function fetchBookmarks(chromeRef = chrome) {
  return new Promise((resolve, reject) => {
    if (chromeRef && chromeRef.runtime && chromeRef.runtime.sendMessage) {
      chromeRef.runtime.sendMessage({ action: 'fetchBookmarks' }, (response) => {
        if (response && response.bookmarks) {
          resolve(response.bookmarks);
        } else {
          reject(new Error(response?.error || 'Failed to fetch bookmarks'));
        }
      });
    } else {
      reject(new Error('chrome.runtime.sendMessage is not available'));
    }
  });
}

export function faviconURL(bookmarkUrl, runtime = chrome.runtime) {
  const url = new URL(runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', bookmarkUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

export function createBookmarkElement(
  bookmark,
  {
    documentRef = document,
    windowRef = window,
    runtime = chrome.runtime,
    faviconURLFn = faviconURL,
  } = {},
) {
  const bookmarkElement = documentRef.createElement('li');
  bookmarkElement.className = 'bookmark-item';
  const faviconUrl = faviconURLFn(bookmark.url, runtime);
  bookmarkElement.innerHTML = `
      <a href="${bookmark.url}" target="_blank" class="bookmark-link">
        <img src="${faviconUrl}" alt="favicon" class="bookmark-icon">
        <span class="bookmark-title">${bookmark.title}</span>
      </a>
    `;

  bookmarkElement.addEventListener('click', () => {
    windowRef.open(bookmark.url, '_blank');
  });

  return bookmarkElement;
}

export function displayBookmarksRecursive(
  bookmarkNode,
  container,
  {
    createBookmarkElementFn = createBookmarkElement,
    runtime = chrome.runtime,
  } = {},
) {
  if (bookmarkNode.children) {
    bookmarkNode.children.forEach((child) => {
      if (child.url) {
        container.appendChild(
          createBookmarkElementFn(child, { runtime }),
        );
      } else if (child.children) {
        displayBookmarksRecursive(child, container, {
          createBookmarkElementFn,
          runtime,
        });
      }
    });
  }
}

export async function displayBookmarks({
  shadow,
  chromeRef = chrome,
  fetchBookmarksFn = fetchBookmarks,
  createBookmarkElementFn = createBookmarkElement,
  displayBookmarksRecursiveFn = displayBookmarksRecursive,
} = {}) {
  try {
    const bookmarks = await fetchBookmarksFn(chromeRef);
    const bookmarkListContainer = shadow.getElementById('bookmark-list');
    bookmarkListContainer.innerHTML = '';

    const { defaultFolders } = await chromeRef.storage.sync.get('defaultFolders');
    const { lastViewedFolder } = await chromeRef.storage.local.get(
      'lastViewedFolder',
    );

    let folderToShow = null;
    let folderContents = [];

    if (defaultFolders?.items?.length > 0) {
      let folderToActivate;

      if (
        lastViewedFolder &&
        defaultFolders.items.some((folder) => folder.id === lastViewedFolder)
      ) {
        folderToActivate = lastViewedFolder;
      } else {
        folderToActivate = defaultFolders.items[0].id;
      }

      try {
        const response = await chromeRef.runtime.sendMessage({
          action: 'getBookmarkFolder',
          folderId: folderToActivate,
        });

        if (response.success && response.folder) {
          folderToShow = response.folder;
          if (response.children) {
            folderContents = response.children;
          }
        }
      } catch (error) {
        console.log('Folder not found:', error);
      }
    }

    if (!folderToShow) {
      try {
        const response = await chromeRef.runtime.sendMessage({
          action: 'getBookmarkFolder',
          folderId: '1',
        });

        if (response.success && response.folder) {
          folderToShow = response.folder;
          if (response.children) {
            folderContents = response.children;
          }
        }
      } catch (error) {
        console.log('Root folder not found:', error);
      }
    }

    if (folderToShow) {
      if (folderToShow.url) {
        bookmarkListContainer.appendChild(
          createBookmarkElementFn(folderToShow, { runtime: chromeRef.runtime }),
        );
      } else if (folderContents.length > 0) {
        folderContents.forEach((child) => {
          if (child.url) {
            bookmarkListContainer.appendChild(
              createBookmarkElementFn(child, { runtime: chromeRef.runtime }),
            );
          }
        });
      } else {
        displayBookmarksRecursiveFn(folderToShow, bookmarkListContainer, {
          createBookmarkElementFn,
          runtime: chromeRef.runtime,
        });
      }
    } else {
      displayBookmarksRecursiveFn(bookmarks[0], bookmarkListContainer, {
        createBookmarkElementFn,
        runtime: chromeRef.runtime,
      });
    }
  } catch (error) {
    console.error('Failed to fetch bookmarks:', error);
  }
}

export function getCurrentSearchEngine(hostname = window.location.hostname) {
  if (hostname.includes('google.com')) {
    return 'google';
  } else if (hostname.includes('bing.com')) {
    return 'bing';
  } else if (hostname.includes('baidu.com')) {
    return 'baidu';
  } else if (hostname.includes('kimi.moonshot.cn')) {
    return 'kimi';
  } else if (hostname.includes('felo.ai')) {
    return 'felo';
  } else if (hostname.includes('metaso.cn')) {
    return 'metaso';
  } else if (hostname.includes('doubao.com')) {
    return 'doubao';
  } else {
    return 'bing';
  }
}
