import { assignToScriptState } from './script-runtime-bridge.js';

function getLocalizedMessage(messageName) {
  const message = chrome.i18n.getMessage(messageName);
  return message || messageName;
}

assignToScriptState({ getLocalizedMessage });
