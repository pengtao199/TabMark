(function initSidePanelManagerDomHelpers(globalScope) {
  function showLoadingSpinner(position = 'top-right') {
    let loadingIndicator = document.getElementById('side-panel-loading-indicator');

    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'side-panel-loading-indicator';
      loadingIndicator.className = 'loading-indicator';

      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      loadingIndicator.appendChild(spinner);

      document.body.appendChild(loadingIndicator);
    }

    loadingIndicator.classList.remove('center', 'top-center', 'bottom-right', 'nav-adjacent');
    if (position !== 'top-right') {
      loadingIndicator.classList.add(position);
    }

    loadingIndicator.style.display = 'block';
  }

  function hideLoadingSpinner() {
    const loadingIndicator = document.getElementById('side-panel-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }

  function addBackButton(onClick) {
    let backButton = document.querySelector('.back-to-links');

    if (!backButton) {
      backButton = document.createElement('div');
      backButton.className = 'back-to-links';
      backButton.innerHTML = '<span class="material-icons">arrow_back</span>';
      document.body.appendChild(backButton);

      backButton.addEventListener('click', () => {
        if (typeof onClick === 'function') {
          onClick();
        }
      });
    }

    backButton.style.display = 'flex';
  }

  function closeIframe() {
    const sidePanelContent = document.getElementById('side-panel-content');
    const backButton = document.querySelector('.back-to-links');
    const navBar = document.querySelector('.side-panel-nav');

    if (sidePanelContent) {
      sidePanelContent.style.display = 'none';
    }

    if (backButton) {
      backButton.style.display = 'none';
    }

    if (navBar) {
      navBar.remove();
    }
  }

  function updateUrlBar(url) {
    const input = document.getElementById('url-input');
    if (input) {
      input.value = url;
    }
  }

  function goBack(manager) {
    if (manager.currentIndex > 0) {
      manager.currentIndex--;
      manager.loadUrl(manager.history[manager.currentIndex]);
      manager.updateNavigationButtons();
    }
  }

  function goForward(manager) {
    if (manager.currentIndex < manager.history.length - 1) {
      manager.currentIndex++;
      manager.loadUrl(manager.history[manager.currentIndex]);
      manager.updateNavigationButtons();
    }
  }

  function refresh(manager) {
    if (manager.currentIndex >= 0) {
      manager.loadUrl(manager.history[manager.currentIndex]);
    }
  }

  function openInNewTab(manager) {
    if (manager.currentIndex >= 0) {
      chrome.tabs.create({ url: manager.history[manager.currentIndex] });
    }
  }

  globalScope.SidePanelManagerDomHelpers = {
    showLoadingSpinner,
    hideLoadingSpinner,
    addBackButton,
    closeIframe,
    updateUrlBar,
    goBack,
    goForward,
    refresh,
    openInNewTab
  };
})(window);
