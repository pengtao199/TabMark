// 侧边栏检测逻辑
(function() {
  const namespace = window.SidePanelNavigation = window.SidePanelNavigation || {};

  namespace.createDetectionController = function createDetectionController({
    state,
    isChromeExtension,
    initOrRefreshNavigationBar
  }) {
    function runDetectionMethods() {
      state.detectionAttempts++;
      console.log(`[SidePanel Navigation] 运行检测方法 (尝试 #${state.detectionAttempts})`);

      state.detectionMethods = [];

      if (isChromeExtension && chrome.runtime.getContexts) {
        const apiDetection = new Promise((resolve) => {
          try {
            chrome.runtime.getContexts({
              contextTypes: ['SIDE_PANEL']
            }, (contexts) => {
              if (chrome.runtime.lastError) {
                console.log('[SidePanel Navigation] API检测错误:', chrome.runtime.lastError);
                resolve(false);
                return;
              }

              if (!contexts || contexts.length === 0) {
                console.log('[SidePanel Navigation] 没有找到侧边栏上下文');
                resolve(false);
                return;
              }

              const sidePanelContextIds = contexts.map(context => context.contextId);

              chrome.runtime.getContextId((currentContext) => {
                if (chrome.runtime.lastError) {
                  console.log('[SidePanel Navigation] 获取当前上下文错误:', chrome.runtime.lastError);
                  resolve(false);
                  return;
                }

                if (!currentContext) {
                  console.log('[SidePanel Navigation] 无法获取当前上下文');
                  resolve(false);
                  return;
                }

                const isInSidePanel = sidePanelContextIds.includes(currentContext.contextId);
                console.log('[SidePanel Navigation] Chrome API检测结果:', isInSidePanel, {
                  sidePanelContextIds,
                  currentContextId: currentContext.contextId
                });

                if (isInSidePanel) {
                  namespace.saveDetectionResult(true);
                }

                resolve(isInSidePanel);
              });
            });
          } catch (e) {
            console.log('[SidePanel Navigation] 运行API检测时出错:', e);
            resolve(false);
          }
        });

        state.detectionMethods.push(apiDetection);
      }

      const traditionalDetection = new Promise((resolve) => {
        const urlParams = new URLSearchParams(window.location.search);
        const isSidePanelView = urlParams.has('sidepanel_view');

        let isSidePanelSession = false;
        let isSidePanelLocal = false;

        try {
          isSidePanelSession = sessionStorage.getItem('sidepanel_view') === 'true';
        } catch (e) {
          console.log('[SidePanel Navigation] sessionStorage不可用:', e);
        }

        try {
          isSidePanelLocal = localStorage.getItem('sidepanel_view') === 'true';
        } catch (e) {
          console.log('[SidePanel Navigation] localStorage不可用:', e);
        }

        if (isChromeExtension && chrome.storage && chrome.storage.session) {
          chrome.storage.session.get(['sidepanel_view', 'sidepanel_last_url'], (result) => {
            const isSidePanelChromeStorage = result && result.sidepanel_view === true;
            const lastUrl = result && result.sidepanel_last_url;
            const urlMatchScore = lastUrl ? namespace.calculateUrlSimilarity(lastUrl, window.location.href) : 0;

            console.log('[SidePanel Navigation] URL相似度分数:', urlMatchScore, {
              lastUrl: lastUrl && lastUrl.substring(0, 50) + '...',
              currentUrl: window.location.href.substring(0, 50) + '...'
            });

            const isUrlMatch = urlMatchScore > 0.7;

            checkTraditionalResults(
              isSidePanelView,
              isSidePanelSession,
              isSidePanelLocal,
              isSidePanelChromeStorage,
              isUrlMatch
            );
          });
        } else {
          checkTraditionalResults(isSidePanelView, isSidePanelSession, isSidePanelLocal, false, false);
        }

        function checkTraditionalResults(fromUrl, fromSession, fromLocal, fromChromeStorage, fromUrlMatch) {
          const referrerIsSidePanel = document.referrer && (
            document.referrer.includes('sidepanel.html') ||
            document.referrer.includes('sidepanel_view=true') ||
            document.referrer.includes('is_sidepanel=true')
          );

          const isInternalNavigation = document.referrer &&
            (new URL(document.referrer)).origin === window.location.origin;

          const urlParams = new URLSearchParams(window.location.search);
          const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' ||
                                   urlParams.get('is_sidepanel') === 'true';

          const isDefinitelySidePanel = (isInternalNavigation && referrerIsSidePanel) || hasSidePanelParam;

          if (hasSidePanelParam) {
            namespace.saveDetectionResult(true);
          }

          const result = isDefinitelySidePanel || fromUrl || fromSession || fromLocal ||
                        fromChromeStorage || fromUrlMatch;

          console.log('[SidePanel Navigation] 传统检测结果:', result, {
            hasSidePanelParam, isInternalNavigation, referrerIsSidePanel, isDefinitelySidePanel,
            fromUrl, fromSession, fromLocal, fromChromeStorage, fromUrlMatch
          });

          if (isDefinitelySidePanel) {
            document.body.classList.add('is-sidepanel');
          }

          resolve(result);
        }
      });

      state.detectionMethods.push(traditionalDetection);

      const domDetection = new Promise((resolve) => {
        setTimeout(() => {
          const hasSidePanelClasses = document.body.classList.contains('is-sidepanel') ||
                                     document.documentElement.classList.contains('is-sidepanel');
          const isNarrowViewport = window.innerWidth <= 480;

          console.log('[SidePanel Navigation] DOM检测结果:', {
            hasSidePanelClasses,
            isNarrowViewport,
            windowWidth: window.innerWidth
          });

          const result = hasSidePanelClasses || isNarrowViewport;

          if (result) {
            namespace.saveDetectionResult(true);
          }

          resolve(result);
        }, 500);
      });

      state.detectionMethods.push(domDetection);

      Promise.all(state.detectionMethods).then(results => {
        const detectionResult = results.some(result => result === true);

        console.log('[SidePanel Navigation] 所有检测方法结果:', results);
        console.log('[SidePanel Navigation] 最终检测结果:', detectionResult);

        const urlParams = new URLSearchParams(window.location.search);
        const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';

        if (detectionResult && hasSidePanelParam && !state.navigationBarAdded) {
          state.inSidePanel = true;
          console.log('[SidePanel Navigation] 确认在侧边栏中，添加导航栏');
          initOrRefreshNavigationBar();
          state.navigationBarAdded = true;
        } else if (!detectionResult || !hasSidePanelParam) {
          console.log('[SidePanel Navigation] 不在侧边栏中，不添加导航栏 (detectionResult=', detectionResult, ', hasSidePanelParam=', hasSidePanelParam, ')');
        }
      });
    }

    return {
      runDetectionMethods
    };
  };
})();
