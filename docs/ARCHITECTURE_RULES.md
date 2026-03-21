# Architecture Rules and Refactor Plan

## Why
The current codebase works, but several files are oversized and mix multiple responsibilities. This increases regression risk and slows iteration.

## File Size Rules

Current enforceable baseline (automated):
- Default per file: min 200 lines, max 500 lines
- Target per file (refactor goal): min 200 lines, max 500 lines

Important notes:
- Minified vendor files are excluded.
- Legacy large files and tiny utility files use temporary override limits in `tools/file-size-rules.json`.
- New files should follow target limits directly unless there is a clear reason.

## Mandatory Boundaries

1. Background layer
- `background.js` should only route messages and orchestrate APIs.
- Action logic should live in dedicated handler modules.

2. UI layer
- New tab and sidepanel page-specific bootstrap should be separate.
- Shared UI logic goes to reusable modules, not global script blocks.
- New tab bookmark interactions should stay split by responsibility:
  - rendering in `script-bookmark-list.js`
  - folder navigation/cache refresh in `script-folder-nav.js`
  - drag/drop organization in `script-sortable.js`
  - create flows in `script-bookmark-create.js`

3. State layer
- Keys and read/write adapters must be centralized.
- Avoid mixing `localStorage` and `chrome.storage.*` for the same key.

4. Navigation layer
- Avoid monkey-patching host-page history unless explicitly required.
- Prefer event-driven navigation signals.

## Refactor Phases

Phase A (done)
- Add file-size enforcement tooling.
- Add baseline architecture rules.
- Fix high-risk background runtime issues.

Phase B (next)
- Continue splitting `src/background/background.js` into:
  - `src/background/router.js`
  - `src/background/handlers/*.js`
  - `src/background/validators.js`

Phase C
- Split `src/newtab/script.js` into:
  - `src/newtab/bootstrap.js`
  - `src/newtab/bookmarks/*.js`
  - `src/newtab/search/*.js`
  - `src/newtab/settings-bridge.js`

Phase D
- Split `src/content/content.js` into floating-ball module and sidepanel-open module.
- Keep sidepanel navigation logic isolated from general content injection.

## CI / Local Gate

Use one of these commands before merging:
- `npm run check:file-size` (fails on violations)
- `npm run report:file-size` (informational)

## Terminal Workflow (Before Split)

1. Create backup
- `npm run backup:now`

2. Audit line size
- `npm run report:file-size`
- `npm run audit:split`
- `npm run audit:split:json` (writes `docs/split-audit.json`)

3. Dependency safety checks
- `npm run deps:circular`
- `npm run deps:orphans`

4. Then perform extraction
- Only split by responsibility (extract modules), do not rewrite behavior.
