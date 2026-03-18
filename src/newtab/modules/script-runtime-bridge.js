const SCRIPT_STATE_KEY = '__tabmarkScript';

export function getScriptState() {
  return globalThis[SCRIPT_STATE_KEY] || (globalThis[SCRIPT_STATE_KEY] = {});
}

export function assignToScriptState(values) {
  return Object.assign(getScriptState(), values);
}
