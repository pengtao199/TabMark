// Legacy compatibility shim.
//
// The active folder-tree actions now live in the modules already imported by
// `script-core.js`. This file stays as a no-op so the dependency graph keeps a
// concrete edge without reintroducing the old duplicated implementation.
export {};
