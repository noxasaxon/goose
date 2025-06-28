# Tauri v2 Frontend Migration Checklist

This document contains the necessary frontend code updates needed to complete the migration from Tauri v1 to v2.

## Context
The Tauri backend has been updated to v2, but the frontend code may still be using v1 APIs. These changes are required to ensure compatibility with Tauri v2.

## Migration Checklist

### 1. Update Window API Imports
- [ ] Search for all imports from `@tauri-apps/api/window`
- [ ] Replace with imports from `@tauri-apps/api/webviewWindow`
- [ ] Update the imported type from `Window` to `WebviewWindow`

**Example:**
```typescript
// OLD (v1)
import { Window } from '@tauri-apps/api/window';
import { appWindow } from '@tauri-apps/api/window';

// NEW (v2)
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
const appWindow = getCurrentWebviewWindow();
```

### 2. Update Plugin Imports
- [ ] Install new plugin packages if not already installed:
  ```bash
  npm install @tauri-apps/plugin-fs
  npm install @tauri-apps/plugin-dialog
  npm install @tauri-apps/plugin-shell
  npm install @tauri-apps/plugin-process
  npm install @tauri-apps/plugin-notification
  npm install @tauri-apps/plugin-deep-link
  npm install @tauri-apps/plugin-window-state
  npm install @tauri-apps/plugin-updater
  ```

- [ ] Update all file system imports:
  ```typescript
  // OLD (v1)
  import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
  
  // NEW (v2)
  import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
  ```

- [ ] Update dialog imports:
  ```typescript
  // OLD (v1)
  import { open, save, message } from '@tauri-apps/api/dialog';
  
  // NEW (v2)
  import { open, save, message } from '@tauri-apps/plugin-dialog';
  ```

- [ ] Update shell imports:
  ```typescript
  // OLD (v1)
  import { Command } from '@tauri-apps/api/shell';
  
  // NEW (v2)
  import { Command } from '@tauri-apps/plugin-shell';
  ```

- [ ] Update process imports:
  ```typescript
  // OLD (v1)
  import { exit, relaunch } from '@tauri-apps/api/process';
  
  // NEW (v2)
  import { exit, relaunch } from '@tauri-apps/plugin-process';
  ```

### 3. Update Event System
- [ ] Update event imports and usage:
  ```typescript
  // OLD (v1)
  import { listen, emit } from '@tauri-apps/api/event';
  
  // NEW (v2)
  import { listen, emit } from '@tauri-apps/api/event';
  // Note: Event API remains in core, but some event names may have changed
  ```

### 4. Update Path API
- [ ] Path API has moved to core:
  ```typescript
  // OLD (v1)
  import { appDir, downloadDir } from '@tauri-apps/api/path';
  
  // NEW (v2)
  import { appDataDir, downloadDir } from '@tauri-apps/api/path';
  // Note: Some function names have changed
  ```

### 5. Update Tauri API Imports
- [ ] Update invoke imports:
  ```typescript
  // OLD (v1)
  import { invoke } from '@tauri-apps/api/tauri';
  
  // NEW (v2)
  import { invoke } from '@tauri-apps/api/core';
  ```

### 6. Handle Breaking Changes
- [ ] Check for usage of removed APIs:
  - `Window.setSkipTaskbar()` is now `Window.setSkipTaskbar(skip)`
  - `Window.startDragging()` now requires a `MouseEvent` parameter
  - Global `window.__TAURI__` is now `window.__TAURI_INTERNALS__`

### 7. Update TypeScript Types
- [ ] Update type imports:
  ```typescript
  // OLD (v1)
  import type { Window } from '@tauri-apps/api/window';
  
  // NEW (v2)
  import type { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  ```

### 8. Test Functionality
- [ ] Test window management functions
- [ ] Test file system operations
- [ ] Test dialog boxes
- [ ] Test shell command execution (goosed sidecar)
- [ ] Test deep linking (goose:// URLs)
- [ ] Test auto-updater functionality
- [ ] Test window state persistence
- [ ] Test notifications

## Common Patterns to Search For

Use these search patterns to find code that needs updating:
- `from '@tauri-apps/api/window'`
- `from '@tauri-apps/api/fs'`
- `from '@tauri-apps/api/dialog'`
- `from '@tauri-apps/api/shell'`
- `from '@tauri-apps/api/process'`
- `from '@tauri-apps/api/tauri'`
- `Window.` (to find Window type usage)
- `appWindow` (common variable name for window instance)
- `__TAURI__` (global variable name changed)

## Resources
- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
- [Tauri v2 API Documentation](https://v2.tauri.app/reference/javascript/)
- [Tauri v2 Plugin Documentation](https://v2.tauri.app/plugins/)

## Notes
- The backend Rust code has already been updated for v2
- All plugin configurations have been added to `tauri.conf.json`
- The window has been given the label "main" to match capabilities