export function openInNewWindow(url) {
  chrome.windows.create({ url }, (window) => {
    console.log(`New window opened with id: ${window.id}`);
  });
}

export function openInIncognito(url) {
  chrome.windows.create({ url, incognito: true }, (window) => {
    console.log(`New incognito window opened with id: ${window.id}`);
  });
}

export function createUtilities(getLocalizedMessage) {
  let toastTimeout;

  function showToast(message = getLocalizedMessage('moreSearchSupportToast'), duration = 1500) {
    const toast = document.getElementById('more-button-toast');
    if (!toast) {
      console.error('Toast element not found');
      return;
    }

    if (toast.classList.contains('show')) {
      clearTimeout(toastTimeout);
      toast.classList.remove('show');
      setTimeout(() => showToast(message, duration), 300);
      return;
    }

    const toastMessage = toast.querySelector('p');
    if (toastMessage) {
      toastMessage.textContent = message;
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function copyBookmarkLink(bookmark) {
    try {
      if (!bookmark || !bookmark.url) {
        throw new Error('No valid bookmark link found');
      }

      navigator.clipboard.writeText(bookmark.url).then(() => {
        showToast(getLocalizedMessage('linkCopied'));
      }).catch((err) => {
        console.error('Failed to copy link:', err);
        showToast(getLocalizedMessage('copyLinkFailed'));
      });
    } catch (error) {
      console.error('Error copying bookmark link:', error);
      if (error.message === 'Extension context invalidated.') {
        showToast(getLocalizedMessage('extensionReloaded'));
      } else {
        showToast(getLocalizedMessage('copyLinkFailed'));
      }
    }
  }

  return {
    showToast,
    copyBookmarkLink
  };
}
