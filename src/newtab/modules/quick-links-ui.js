import { ICONS } from '../icons.js';
import { faviconURL } from '../../shared/link-utils.js';
import { createQuickLinksRenderer } from './quick-links-ui-render.js';

function getLocalizedMessage(messageName) {
  const message = chrome.i18n.getMessage(messageName);
  return message || messageName;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

export function createQuickLinksUI(actions) {
  let quickLinkToDelete = null;

  function openInIncognito(url) {
    chrome.windows.create({ url, incognito: true });
  }

  function copyToClipboard(url) {
    try {
      navigator.clipboard.writeText(url).then(() => {
        showToast(getLocalizedMessage('linkCopied'));
      }).catch(() => {
        showToast(getLocalizedMessage('copyLinkFailed'));
      });
    } catch (err) {
      console.error('Copy failed:', err);
      showToast(getLocalizedMessage('copyLinkFailed'));
    }
  }

  function createQRCode(url, bookmarkName) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';

    const qrContainer = document.createElement('div');
    qrContainer.style.backgroundColor = 'white';
    qrContainer.style.padding = '1.5rem 3rem';
    qrContainer.style.width = '320px';
    qrContainer.style.borderRadius = '10px';
    qrContainer.style.display = 'flex';
    qrContainer.style.flexDirection = 'column';
    qrContainer.style.alignItems = 'center';
    qrContainer.style.position = 'relative';

    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => document.body.removeChild(modal);
    qrContainer.appendChild(closeButton);

    const title = document.createElement('h2');
    title.textContent = getLocalizedMessage('scanQRCode');
    title.style.marginBottom = '20px';
    title.style.fontWeight = '600';
    title.style.fontSize = '0.875rem';
    qrContainer.appendChild(title);

    const qrCodeElement = document.createElement('div');
    qrContainer.appendChild(qrCodeElement);

    const urlDisplay = document.createElement('div');
    urlDisplay.textContent = url;
    urlDisplay.style.marginTop = '20px';
    urlDisplay.style.wordBreak = 'break-all';
    urlDisplay.style.maxWidth = '300px';
    urlDisplay.style.textAlign = 'center';
    qrContainer.appendChild(urlDisplay);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.width = '100%';
    buttonContainer.style.marginTop = '20px';

    const copyButton = document.createElement('button');
    copyButton.textContent = getLocalizedMessage('copyLink');
    copyButton.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        copyButton.textContent = getLocalizedMessage('copied');
        setTimeout(() => {
          copyButton.textContent = getLocalizedMessage('copyLink');
        }, 2000);
      });
    };

    const downloadButton = document.createElement('button');
    downloadButton.textContent = getLocalizedMessage('download');
    downloadButton.onclick = () => {
      setTimeout(() => {
        const canvas = qrCodeElement.querySelector('canvas');
        if (canvas) {
          const link = document.createElement('a');
          const fileName = `${bookmarkName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qrcode.png`;
          link.download = fileName;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }, 100);
    };

    [copyButton, downloadButton].forEach((button) => {
      button.style.padding = '5px 10px';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.cursor = 'pointer';
      button.style.backgroundColor = '#f0f0f0';
      button.style.color = '#333';
      button.style.transition = 'all 0.3s ease';

      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#e0e0e0';
        button.style.color = '#111827';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#f0f0f0';
        button.style.color = '#717882';
      });
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(downloadButton);
    qrContainer.appendChild(buttonContainer);

    modal.appendChild(qrContainer);
    document.body.appendChild(modal);

    new QRCode(qrCodeElement, {
      text: url,
      width: 200,
      height: 200
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  function editQuickLink(site) {
    const editDialog = document.getElementById('edit-dialog');
    const editNameInput = document.getElementById('edit-name');
    const editUrlInput = document.getElementById('edit-url');
    const editDialogTitle = editDialog.querySelector('h2');

    editDialogTitle.textContent = chrome.i18n.getMessage('editDialogTitle');
    editNameInput.value = site.name;
    editUrlInput.value = site.url;
    editDialog.style.display = 'block';

    document.getElementById('edit-form').onsubmit = function (event) {
      event.preventDefault();
      const newName = editNameInput.value.trim();
      const newUrl = editUrlInput.value.trim();

      if (newName && newUrl) {
        const oldUrl = site.url;
        const updatedSite = {
          name: newName,
          url: newUrl,
          favicon: faviconURL(newUrl),
          fixed: true
        };
        actions.updateFixedShortcut(updatedSite, oldUrl);
        editDialog.style.display = 'none';
      }
    };

    document.querySelector('.cancel-button').onclick = function () {
      editDialog.style.display = 'none';
    };

    document.querySelector('.close-button').onclick = function () {
      editDialog.style.display = 'none';
    };
  }

  function refreshQuickLink(site, oldUrl) {
    const linkItem = document.querySelector(`.quick-link-item-container[data-url="${oldUrl}"]`);
    if (linkItem) {
      const link = linkItem.querySelector('a');
      const img = link.querySelector('img');
      const span = linkItem.querySelector('span');

      link.href = site.url;

      const newFaviconUrl = faviconURL(site.url);
      img.src = newFaviconUrl;
      img.alt = `${site.name} Favicon`;
      img.onerror = function () {
        this.src = '../images/placeholder-icon.svg';
      };

      span.textContent = site.name;
      linkItem.dataset.url = site.url;
    } else {
      console.error('Quick link element not found for:', oldUrl);
      actions.generateQuickLinks();
    }
  }

  function addToBlacklistConfirm(site) {
    console.log('=== Quick Link Delete Confirmation ===');
    console.log('Quick link to delete:', site);

    const confirmDialog = document.getElementById('confirm-dialog');
    const confirmMessage = document.getElementById('confirm-dialog-message');
    const confirmDeleteQuickLinkMessage = document.getElementById('confirm-delete-quick-link-message');

    quickLinkToDelete = site;
    console.log('Set quickLinkToDelete:', quickLinkToDelete);

    if (confirmMessage) {
      confirmMessage.style.display = 'none';
    }

    if (confirmDeleteQuickLinkMessage) {
      confirmDeleteQuickLinkMessage.style.display = 'block';
      confirmDeleteQuickLinkMessage.innerHTML = chrome.i18n.getMessage(
        'confirmDeleteQuickLinkMessage',
        `<strong>${site.name}</strong>`
      );
      console.log('Setting quick link delete message:', confirmDeleteQuickLinkMessage.innerHTML);
    } else {
      console.error('Quick link delete message element not found');
    }

    confirmDialog.style.display = 'block';

    document.getElementById('confirm-delete-button').onclick = function () {
      console.log('=== Quick Link Delete Confirmed ===');
      console.log('Current quickLinkToDelete:', quickLinkToDelete);

      if (quickLinkToDelete) {
        const domain = new URL(quickLinkToDelete.url).hostname;
        console.log('Deleting domain:', domain);

        actions.addToBlacklist(domain).then((added) => {
          console.log('Domain added to blacklist:', added);
          if (added) {
            if (quickLinkToDelete.fixed) {
              console.log('Removing fixed shortcut:', quickLinkToDelete);
              chrome.storage.sync.get('fixedShortcuts', (result) => {
                const fixedShortcuts = result.fixedShortcuts || [];
                const updatedShortcuts = fixedShortcuts.filter((shortcut) => shortcut.url !== quickLinkToDelete.url);
                chrome.storage.sync.set({ fixedShortcuts: updatedShortcuts });
              });
            }
            actions.generateQuickLinks();
            showToast(chrome.i18n.getMessage('deleteSuccess'));
          }
          confirmDialog.style.display = 'none';
          if (confirmMessage) confirmMessage.style.display = 'block';
          if (confirmDeleteQuickLinkMessage) confirmDeleteQuickLinkMessage.style.display = 'none';
          console.log('Clearing quickLinkToDelete state');
          quickLinkToDelete = null;
        });
      } else {
        console.error('No quick link selected for deletion');
      }
    };

    document.getElementById('cancel-delete-button').onclick = function () {
      console.log('=== Quick Link Delete Cancelled ===');
      console.log('Clearing quickLinkToDelete:', quickLinkToDelete);
      confirmDialog.style.display = 'none';
      if (confirmMessage) confirmMessage.style.display = 'block';
      if (confirmDeleteQuickLinkMessage) confirmDeleteQuickLinkMessage.style.display = 'none';
      quickLinkToDelete = null;
    };
  }

  function showContextMenu(e, site) {
    console.log('=== Quick Link Context Menu ===');
    console.log('Event:', e.type);
    console.log('Site:', site);

    e.preventDefault();

    const existingMenu = document.querySelector('.custom-context-menu');
    if (existingMenu) {
      console.log('Removing existing context menu');
      existingMenu.remove();
    }

    const contextMenu = document.createElement('div');
    contextMenu.className = 'custom-context-menu';
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;

    const menuItems = [
      { text: chrome.i18n.getMessage('openInNewTab'), icon: 'open_in_new', action: () => window.open(site.url, '_blank') },
      { text: chrome.i18n.getMessage('openInNewWindow'), icon: 'launch', action: () => window.open(site.url, '_blank', 'noopener,noreferrer') },
      { text: chrome.i18n.getMessage('openInIncognito'), icon: 'visibility_off', action: () => openInIncognito(site.url) },
      { text: chrome.i18n.getMessage('editQuickLink'), icon: 'edit', action: () => editQuickLink(site) },
      { text: chrome.i18n.getMessage('deleteQuickLink'), icon: 'delete', action: () => addToBlacklistConfirm(site) },
      { text: chrome.i18n.getMessage('copyLink'), icon: 'content_copy', action: () => copyToClipboard(site.url) },
      { text: chrome.i18n.getMessage('createQRCode'), icon: 'qr_code', action: () => createQRCode(site.url, site.name) }
    ];

    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'custom-context-menu-item';

      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.innerHTML = ICONS[item.icon];

      const text = document.createElement('span');
      text.textContent = item.text;

      menuItem.appendChild(icon);
      menuItem.appendChild(text);

      menuItem.addEventListener('click', () => {
        item.action();
        contextMenu.remove();
      });

      if (index === 3 || index === 5) {
        const divider = document.createElement('div');
        divider.className = 'custom-context-menu-divider';
        contextMenu.appendChild(divider);
      }

      contextMenu.appendChild(menuItem);
    });

    document.body.appendChild(contextMenu);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuRect = contextMenu.getBoundingClientRect();

    if (e.clientX + menuRect.width > viewportWidth) {
      contextMenu.style.left = `${viewportWidth - menuRect.width}px`;
    }

    if (e.clientY + menuRect.height > viewportHeight) {
      contextMenu.style.top = `${viewportHeight - menuRect.height}px`;
    }

    function closeMenu(event) {
      if (!contextMenu.contains(event.target)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    }

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  const quickLinksRenderer = createQuickLinksRenderer({
    onContextMenu: showContextMenu
  });

  return {
    renderQuickLinks: quickLinksRenderer,
    refreshQuickLink
  };
}
