# Folder Structure

## Current Layout

- `src/background/`
  - `background.js`: service worker entry
  - `background-logic.js`: background module loader
  - `background-state.js`: background runtime state hydration/persistence
  - `background-navigation-handlers.js`: navigation/home related handlers
  - `background-action-handlers.js`: bookmark/action handlers
  - `background-router.js`: message routing entry
  - `rules.js`: background request validation and constants

- `src/shared/`
  - `storage-keys.js`: shared key definitions
  - `open-mode.js`: shared open-mode read helpers
  - `link-utils.js`: shared link/favicon/title helpers

- `src/newtab/`
  - page-level scripts for newtab/sidepanel UI
  - `script.js`, `settings.js`, `quick-links.js`, `search-engine-dropdown.js`, etc.
  - `color-utils.js`: color extraction/cache helpers
  - `qrcode-modal.js`: QR code modal rendering/actions
  - `bookmark-actions.js`: bookmark open/copy/toast actions
  - `ui-helpers.js`: scroll indicator, settings modal, feedback helpers
  - `modules/`: extracted feature slices (e.g. `special-links.js`)

- `src/content/`
  - `content.js`: floating button / sidebar entry on web pages
  - `sidepanel-navigation.js`: sidepanel navigation bar injection
  - `navigation-handler.js`: in-page navigation helper

- `src/sidepanel/`
  - `manager.js`: sidepanel manager main class
  - `manager-dom-helpers.js`: sidepanel manager DOM helper methods

- `src/vendor/`
  - third-party/minified scripts (`lodash`, `qrcode`, `Sortable`)

## Rules

1. New shared utilities go into `src/shared/`.
2. Background-only logic goes into `src/background/`.
3. Sidepanel-only logic goes into `src/sidepanel/`.
4. Do not add new flat files under `src/` unless they are page entry files or static assets.
5. Keep module names explicit (`*-helpers`, `*-validators`, `*-handlers`).

## Next Refactor Targets

1. Split `src/newtab/script.js` into smaller modules (`bookmarks`, `search`, `ui`).
2. Split `src/content/content.js` into focused modules (`floating`, `selection`, `open-sidepanel`).
3. Move background action handlers into `src/background/handlers/`.
