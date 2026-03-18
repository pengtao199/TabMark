import { getScriptState } from './script-runtime-bridge.js';

const S = getScriptState();
const getLocalizedMessage = (...args) => S.getLocalizedMessage(...args);

// 修改 showContextMenu 函数
