# Goose Electron → Tauri Migration Plan

## Table of Contents
1. [Overview](#overview)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Migration Requirements](#migration-requirements)
4. [Technical Research](#technical-research)
5. [Migration Phases](#migration-phases)
6. [Task List](#task-list)
7. [Risk Mitigation](#risk-mitigation)
8. [Success Metrics](#success-metrics)

## Overview

This document contains all research, findings, and planning for migrating the Goose desktop application from Electron 33 to Tauri 2.x. The migration aims to achieve:
- **80%+ reduction in bundle size** (from ~200-300MB to ~20-40MB)
- **70%+ reduction in memory usage** (from 400-600MB to 60-120MB)
- **Improved security** through Tauri's permission model
- **Native performance** using system WebView

## Current Architecture Analysis

### Directory Structure
- **Location**: `ui/desktop/`
- **Main Files**:
  - `src/main.ts` (2082 lines) - Main process
  - `src/preload.ts` (230 lines) - IPC bridge
  - `src/goosed.ts` - Sidecar process management
  - React app in `src/renderer/`

### Key Components

#### 1. Main Process (`main.ts`)
- Window creation and management
- Goosed sidecar process spawning
- Deep link handling (`goose://`)
- System tray and dock management
- File operations and security
- Auto-updater logic

#### 2. Preload Script (`preload.ts`)
Exposes 40+ IPC functions organized into categories:

**Window Management**
- `reactReady()`
- `hideWindow()`
- `createChatWindow()`

**File System Operations**
- `directoryChooser()`
- `selectFileOrDirectory()`
- `readFile()`
- `writeFile()`
- `ensureDirectory()`
- `listFiles()`
- `getAllowedExtensions()`
- `getPathForFile()`

**User Interface**
- `showNotification()`
- `showMessageBox()`

**System Integration**
- `openInChrome()`
- `fetchMetadata()`
- `reloadApp()`
- `restartApp()`

**Power Management**
- `startPowerSaveBlocker()`
- `stopPowerSaveBlocker()`

**Binary Management**
- `getBinaryPath()`
- `checkForOllama()`

**Settings Management**
- `getSettings()`
- `setSchedulingEngine()`
- `setQuitConfirmation()`
- `getQuitConfirmationState()`
- `openNotificationsSettings()`

**Platform-Specific UI**
- `setMenuBarIcon()` (macOS)
- `getMenuBarIconState()`
- `setDockIcon()` (macOS)
- `getDockIconState()`

**Image Handling**
- `saveDataUrlToTemp()`
- `deleteTempFile()`
- `getTempImage()`

**Update Management**
- `getVersion()`
- `checkForUpdates()`
- `downloadUpdate()`
- `installUpdate()`
- `onUpdaterEvent()`
- `getUpdateState()`

**Event System**
- `on()`
- `off()`
- `emit()`

**Utility Functions**
- `logInfo()`
- `getConfig()`

#### 3. Goosed Sidecar
- Rust-based backend server
- Dynamic port allocation
- Health monitoring via status endpoint
- Binary location: `resources/bin/goosed`

#### 4. Build System
- Electron Forge for packaging
- Multiple platform support (macOS, Windows, Linux)
- Code signing and notarization setup

## Migration Requirements

### From migration_info.md
1. Replace all Node.js-specific APIs
2. Maintain feature parity
3. Preserve existing React codebase
4. Keep goosed sidecar architecture
5. Support all platforms (macOS, Windows, Linux)

### From migration_checklist_goose_tauri.md
- Step-by-step tactical action plan provided
- Focus on command mapping first
- Window spawning with dummy page
- Iterate until parity achieved

## Technical Research

### Tauri 2.x Best Practices

#### Sidecar Implementation
1. **Binary Naming**: Must include target triple
   - Linux: `goosed-x86_64-unknown-linux-gnu`
   - macOS Silicon: `goosed-aarch64-apple-darwin`
   - Windows: `goosed-x86_64-pc-windows-msvc.exe`

2. **Permissions**: Explicit configuration required
```json
{
  "permissions": [
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "binaries/goosed",
          "sidecar": true
        }
      ]
    }
  ]
}
```

3. **Communication**: TCP preferred over stdin/stdout

#### Window State Plugin
```rust
// Rust
tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::default().build())
```

```javascript
// JavaScript
import { saveWindowState, StateFlags } from '@tauri-apps/plugin-window-state';
saveWindowState(StateFlags.ALL);
```

#### Deep Linking
```json
// tauri.conf.json
{
  "plugins": {
    "deep-link": {
      "schemes": ["goose"]
    }
  }
}
```

```javascript
// Handle deep links
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
await onOpenUrl((urls) => {
  console.log('Deep link opened:', urls);
});
```

## Migration Phases

### Phase 1: Project Setup & Scaffolding
1. Create migration branch
2. Install dependencies (Rust, cargo-tauri)
3. Initialize Tauri project structure
4. Configure build system

### Phase 2: Core Migration
1. Window management
2. IPC function migration (40+ functions)
3. Event system
4. Goosed sidecar integration

### Phase 3: Feature Parity
1. Platform-specific features
2. Security & permissions
3. Build & distribution setup

### Phase 4: Testing & Validation
1. Migrate tests to Tauri WebDriver
2. Performance validation
3. Cross-platform testing

### Phase 5: Cleanup & Documentation
1. Remove Electron code
2. Update documentation
3. Release preparation

## Task List

### Preparation Tasks
- [ ] Create `tauri-migration` branch from main
- [ ] Install Rust 1.78+ and cargo-tauri
- [ ] Set up development environment
- [ ] Review current test suite

### Phase 1: Setup (Week 1)
- [ ] Initialize Tauri project at `ui/tauri/`
- [ ] Configure tauri.conf.json
- [ ] Set up basic window creation
- [ ] Configure Vite integration
- [ ] Test basic React app loading

### Phase 2: Sidecar Integration (Week 1-2)
- [ ] Configure goosed as Tauri sidecar
- [ ] Set up binary naming for all platforms
- [ ] Implement sidecar spawn command
- [ ] Test sidecar communication
- [ ] Implement health monitoring

### Phase 3: IPC Migration (Week 2-4)
#### File System Commands
- [ ] Migrate directoryChooser
- [ ] Migrate selectFileOrDirectory
- [ ] Migrate readFile
- [ ] Migrate writeFile
- [ ] Migrate ensureDirectory
- [ ] Migrate listFiles
- [ ] Migrate getAllowedExtensions
- [ ] Migrate getPathForFile

#### Window Management
- [ ] Migrate reactReady
- [ ] Migrate hideWindow
- [ ] Migrate createChatWindow
- [ ] Implement window state persistence

#### System Integration
- [ ] Implement deep linking (goose://)
- [ ] Migrate power save blocker
- [ ] Migrate notifications
- [ ] Migrate system tray
- [ ] Migrate dock icon (macOS)

#### Settings & Config
- [ ] Migrate settings management
- [ ] Migrate app config API
- [ ] Migrate quit confirmation

#### Update System
- [ ] Configure Tauri updater
- [ ] Set up signing keys
- [ ] Migrate update UI

#### Utilities
- [ ] Migrate image handling
- [ ] Migrate metadata fetching
- [ ] Migrate logging functions

### Phase 4: Platform Features (Week 4-5)
- [ ] macOS: Menu bar icon
- [ ] macOS: Dock integration
- [ ] Windows: System tray
- [ ] Linux: Desktop integration
- [ ] All: File associations

### Phase 5: Testing (Week 5-6)
- [ ] Update Playwright tests
- [ ] Add Tauri-specific tests
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Cross-platform testing

### Phase 6: Build & Release (Week 6)
- [ ] Configure GitHub Actions
- [ ] Set up code signing
- [ ] Configure notarization
- [ ] Test auto-updater
- [ ] Prepare release builds

### Phase 7: Cleanup (Week 6-7)
- [ ] Remove Electron dependencies
- [ ] Delete ui/desktop directory
- [ ] Update documentation
- [ ] Update README
- [ ] Create migration guide

## Risk Mitigation

1. **Parallel Development**: Keep Electron version functional during migration
2. **Feature Flags**: Ability to switch between Electron/Tauri builds
3. **Incremental Testing**: Test each component thoroughly before moving on
4. **Rollback Plan**: Maintain ability to revert to Electron if critical issues found
5. **Beta Testing**: Release Tauri version as beta before full switch

## Success Metrics

### Performance
- [ ] Bundle size < 40MB (from ~250MB)
- [ ] Memory usage < 120MB idle (from ~500MB)
- [ ] Startup time < 2 seconds
- [ ] CPU usage reduced by 50%+

### Functionality
- [ ] All 40+ IPC functions working
- [ ] All platforms supported
- [ ] All tests passing
- [ ] No feature regressions

### User Experience
- [ ] Smooth window management
- [ ] Responsive UI
- [ ] Working auto-updates
- [ ] Proper system integration

## Progress Log

### 2025-06-28: Phase 1 & 2 Progress

#### Completed Tasks:
1. ✅ Created tauri-migration branch (using existing noxasaxon-tauri branch)
2. ✅ Verified Rust 1.88.0 and cargo-tauri 2.4.1 installed
3. ✅ Initialized Tauri project structure at `ui/tauri/`
4. ✅ Configured tauri.conf.json with proper settings
5. ✅ Set up Vite integration for React app
6. ✅ Added all necessary Tauri plugins
7. ✅ Configured goosed as Tauri sidecar:
   - Created binaries directory
   - Built prepare-sidecar.js script for platform-specific naming
   - Successfully prepared goosed-aarch64-apple-darwin binary
   - Updated tauri.conf.json with sidecar configuration
   - Added shell:allow-execute permission for sidecar

#### In Progress:
- Implementing sidecar spawn commands and lifecycle management
  - Created goosed.rs module with port finding and spawn logic
  - Added reqwest, tokio, and dirs dependencies
  - Registered Tauri commands for goosed management
  - Next: Test sidecar spawning functionality

## Next Steps

1. Complete sidecar lifecycle implementation
2. Test Tauri dev mode with goosed sidecar
3. Begin migrating IPC functions (Phase 3)

## References

- [Tauri 2.x Documentation](https://v2.tauri.app/)
- [Tauri Migration Guide](https://v2.tauri.app/start/migrate/)
- [Window State Plugin](https://v2.tauri.app/plugin/window-state/)
- [Deep Linking Plugin](https://v2.tauri.app/plugin/deep-linking/)
- [Sidecar Documentation](https://v2.tauri.app/develop/sidecar/)

---

*Document created: 2025-06-28*
*Last updated: 2025-06-28*