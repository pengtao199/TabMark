import { getMainOpenInNewTab, getSidepanelOpenMode } from '../../shared/open-mode.js';

export function createQuickLinksRenderer({ onContextMenu }) {
  return function renderQuickLinks(shortcuts) {
    const quickLinksContainer = document.getElementById('quick-links');
    const fragment = document.createDocumentFragment();

    quickLinksContainer.innerHTML = '';

    shortcuts.forEach((site) => {
      const linkItem = document.createElement('div');
      linkItem.className = 'quick-link-item-container';
      linkItem.dataset.url = site.url;

      const link = document.createElement('a');
      link.href = site.url;
      link.className = 'quick-link-item';

      link.addEventListener('click', async function (event) {
        event.preventDefault();

        try {
          const isSidePanel = window.location.pathname.endsWith('sidepanel.html');

          console.log('[Quick Link Click] Starting...', {
            url: site.url,
            currentUrl: window.location.href,
            isSidePanel
          });

          if (isSidePanel) {
            console.log('[Quick Link Click] Opening in Side Panel mode');
            const { openInNewTab, openInSidepanel } = await getSidepanelOpenMode();

            console.log('[Quick Link Click] Side Panel settings:', {
              openInNewTab,
              openInSidepanel
            });

            if (openInSidepanel) {
              console.log('[Quick Link Click] Opening in Side Panel iframe');
              try {
                if (typeof SidePanelManager === 'undefined') {
                  console.log('[Quick Link Click] SidePanelManager not defined, using fallback method');
                  const sidePanelContent = document.getElementById('side-panel-content');
                  const sidePanelIframe = document.getElementById('side-panel-iframe');

                  if (sidePanelContent && sidePanelIframe) {
                    sidePanelContent.style.display = 'block';
                    sidePanelIframe.src = site.url;

                    let backButton = document.querySelector('.back-to-links');
                    if (!backButton) {
                      backButton = document.createElement('div');
                      backButton.className = 'back-to-links';
                      backButton.innerHTML = '<span class="material-icons">arrow_back</span>';
                      document.body.appendChild(backButton);

                      backButton.addEventListener('click', () => {
                        sidePanelContent.style.display = 'none';
                        backButton.style.display = 'none';
                      });
                    }

                    backButton.style.display = 'flex';
                  } else {
                    console.error('[Quick Link Click] Side panel elements not found, falling back to new tab');
                    chrome.tabs.create({
                      url: site.url,
                      active: true
                    });
                  }
                } else if (window.sidePanelManager) {
                  window.sidePanelManager.loadUrl(site.url);
                } else {
                  window.sidePanelManager = new SidePanelManager();
                  window.sidePanelManager.loadUrl(site.url);
                }
              } catch (error) {
                console.error('[Quick Link Click] Error using SidePanelManager:', error);
                chrome.tabs.create({
                  url: site.url,
                  active: true
                });
              }
            } else if (openInNewTab) {
              chrome.tabs.create({
                url: site.url,
                active: true
              }).then((tab) => {
                console.log('[Quick Link Click] Tab created successfully:', tab);
              }).catch((error) => {
                console.error('[Quick Link Click] Failed to create tab:', error);
              });
            }
          } else {
            console.log('[Quick Link Click] Opening in Main Window mode');
            const openInNewTab = await getMainOpenInNewTab();
            console.log('[Quick Link Click] Settings check:', { openInNewTab });

            if (openInNewTab) {
              window.open(site.url, '_blank');
            } else {
              window.location.href = site.url;
            }
          }
        } catch (error) {
          console.error('[Quick Link Click] Error:', error);
        }
      });

      const img = document.createElement('img');
      img.src = site.favicon;
      img.alt = `${site.name} Favicon`;
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        this.src = '../images/placeholder-icon.svg';
      });

      link.appendChild(img);

      const span = document.createElement('span');
      span.textContent = site.name;

      linkItem.appendChild(link);
      linkItem.appendChild(span);

      linkItem.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        onContextMenu(event, site);
      });

      fragment.appendChild(linkItem);
    });

    const placeholdersNeeded = Math.min(0, 10 - shortcuts.length);
    if (shortcuts.length < 10) {
      for (let i = 0; i < placeholdersNeeded; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'quick-link-placeholder';

        if (i === 0 && shortcuts.length === 0) {
          const hint = document.createElement('span');
          hint.className = 'placeholder-hint';
          hint.textContent = '访问网站将自动添加到这里';
          placeholder.appendChild(hint);
        }

        fragment.appendChild(placeholder);
      }
    }

    quickLinksContainer.appendChild(fragment);
  };
}
