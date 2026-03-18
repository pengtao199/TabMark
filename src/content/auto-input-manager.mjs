export class AutoInputManager {
  constructor(siteConfigs) {
    this.siteConfigs = siteConfigs;
    this.currentConfig = null;
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async waitForElement(selector) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  async simulateUserInput(inputField, text, isHTML = false) {
    inputField.innerHTML = '';
    inputField.focus();

    let commandSucceeded = false;
    if (!isHTML) {
      try {
        commandSucceeded = document.execCommand('insertText', false, text);
      } catch (error) {
        void error;
      }
    }

    if (!commandSucceeded || isHTML) {
      if (
        inputField.tagName.toLowerCase() === 'textarea' ||
        inputField.tagName.toLowerCase() === 'input'
      ) {
        if (typeof inputField.setSelectionRange === 'function') {
          inputField.setSelectionRange(
            inputField.value.length,
            inputField.value.length,
          );
        }
        if (typeof inputField.insertText === 'function' && !isHTML) {
          inputField.insertText(text);
        } else {
          inputField.value = text;
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        if (isHTML) {
          inputField.innerHTML = text;
        } else {
          inputField.textContent = text;
        }

        const eventType = isHTML ? 'innerHTML' : 'insertText';
        inputField.dispatchEvent(
          new InputEvent('input', {
            inputType: eventType,
            data: text,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    }

    await this.sleep(this.currentConfig.retryDelay);
    await this.checkAndClick(inputField, text, 0);
  }

  async checkAndClick(inputField, expectedText, retryCount) {
    let inputContent;
    if (
      inputField.tagName.toLowerCase() === 'textarea' ||
      inputField.tagName.toLowerCase() === 'input'
    ) {
      inputContent = inputField.value.trim();
    } else {
      inputContent = inputField.textContent.trim();
    }

    if (inputContent === expectedText) {
      await this.simulateButtonClick();
    } else if (retryCount < this.currentConfig.maxRetries) {
      await this.sleep(this.currentConfig.retryDelay);
      await this.simulateUserInput(inputField, expectedText);
    } else {
      if (
        inputField.tagName.toLowerCase() === 'textarea' ||
        inputField.tagName.toLowerCase() === 'input'
      ) {
        inputField.value = expectedText;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        inputField.textContent = expectedText;
        inputField.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      await this.sleep(this.currentConfig.retryDelay);
      await this.simulateButtonClick();
    }
  }

  async simulateButtonClick() {
    const sendButton = await this.waitForElement(this.currentConfig.sendButtonSelector);
    if (sendButton) {
      sendButton.click();
    }
  }

  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  async start() {
    const currentUrl = new URL(window.location.href);

    this.currentConfig = this.siteConfigs.find((config) => {
      const patternUrl = new URL(config.urlPattern);
      return this.compareUrls(currentUrl, patternUrl);
    });
    if (!this.currentConfig) {
      return;
    }

    const inputField = await this.waitForElement(this.currentConfig.inputFieldSelector);

    const searchTerm = this.getUrlParameter(this.currentConfig.urlParamName);
    if (searchTerm) {
      await this.sleep(this.currentConfig.retryDelay);
      await this.simulateUserInput(inputField, searchTerm);
    }
  }

  compareUrls(currentUrl, patternUrl) {
    if (currentUrl.protocol !== patternUrl.protocol) return false;
    if (currentUrl.hostname !== patternUrl.hostname) return false;

    const currentPath = currentUrl.pathname.replace(/\/$/, '');
    const patternPath = patternUrl.pathname.replace(/\/$/, '');

    return currentPath === patternPath || currentPath.startsWith(patternPath + '/');
  }
}

export const siteConfigs = [
  {
    urlPattern: 'https://kimi.moonshot.cn/',
    inputFieldSelector: '[role="textbox"]',
    sendButtonSelector: 'div[class="send-button"]',
    urlParamName: 'q',
    maxRetries: 3,
    retryDelay: 1000,
  },
  {
    urlPattern: 'https://chatgpt.com/',
    inputFieldSelector: 'textarea[data-id="root"]',
    sendButtonSelector: 'button[data-testid="send_button"]',
    urlParamName: 'q',
    maxRetries: 5,
    retryDelay: 1500,
  },
  {
    urlPattern: 'https://www.doubao.com/chat/',
    inputFieldSelector: 'textarea[data-testid="chat_input_input"]',
    sendButtonSelector: 'button#flow-end-msg-send[data-testid="chat_input_send_button"]',
    urlParamName: 'q',
    maxRetries: 2,
    retryDelay: 1500,
  },
  {
    urlPattern: 'https://chat.deepseek.com/',
    inputFieldSelector: 'textarea#chat-input',
    sendButtonSelector: 'div.f6d670[role="button"]',
    urlParamName: 'q',
    maxRetries: 2,
    retryDelay: 1500,
  },
  {
    urlPattern: 'https://grok.com/',
    inputFieldSelector: 'textarea.grok-chat-input',
    sendButtonSelector: 'button.grok-send-button',
    urlParamName: 'q',
    maxRetries: 3,
    retryDelay: 1000,
  },
];
