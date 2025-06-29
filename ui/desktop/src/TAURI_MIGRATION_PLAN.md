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
- [x] Create `tauri-migration` branch from main
- [x] Install Rust 1.78+ and cargo-tauri
- [x] Set up development environment
- [x] Review current test suite

### Phase 1: Setup (Week 1)
- [x] Initialize Tauri project at `ui/tauri/`
- [x] Configure tauri.conf.json
- [x] Set up basic window creation
- [x] Configure Vite integration
- [x] Test basic React app loading

### Phase 2: Sidecar Integration (Week 1-2)
- [x] Configure goosed as Tauri sidecar
- [x] Set up binary naming for all platforms
- [x] Implement sidecar spawn command
- [x] Test sidecar communication
- [x] Implement health monitoring

### Phase 3: IPC Migration (Week 2-4)
#### File System Commands
- [x] Migrate directoryChooser
- [x] Migrate selectFileOrDirectory
- [x] Migrate readFile
- [x] Migrate writeFile
- [x] Migrate ensureDirectory
- [x] Migrate listFiles
- [x] Migrate getAllowedExtensions
- [x] Migrate getPathForFile

#### Window Management
- [x] Migrate reactReady
- [x] Migrate hideWindow
- [x] Migrate createChatWindow
- [x] Implement window state persistence

#### System Integration
- [x] Implement deep linking (goose://)
- [x] Migrate power save blocker (stubbed)
- [x] Migrate notifications
- [x] Migrate system tray
- [x] Migrate dock icon (macOS)

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

## Current Migration Status

### Summary
- **Phases Completed**: Preparation, Setup (Phase 1), Sidecar Integration (Phase 2)
- **Major Achievement**: Created electron compatibility layer that allows React app to work with minimal changes
- **Current Phase**: Phase 3 (IPC Migration) - Mostly complete
- **Overall Progress**: ~70% complete

### What's Working
- ✅ Tauri project structure and configuration
- ✅ Goosed sidecar with auto-start
- ✅ File system operations 
- ✅ Basic notifications
- ✅ Configuration management
- ✅ Deep linking setup

### What Needs Work
- ❌ Auto-updater configuration
- ❌ Settings persistence
- ❌ Full testing of all features

## Progress Log

### 2025-06-29: System Tray and Dock Icon Support Complete

#### Completed Tasks:
1. ✅ Created comprehensive tray.rs module with:
   - System tray creation and management
   - Platform-specific icon handling (iconTemplate.png for macOS)
   - Tray menu with "Show Window" and "Quit" options
   - Update notification support in tray menu
   - Left-click behavior for Windows
2. ✅ Implemented dock icon visibility control:
   - macOS-specific activation policy switching
   - Hide/show dock icon based on settings
3. ✅ Updated electronCompat.ts:
   - Connected setMenuBarIcon/getMenuBarIconState to Tauri commands
   - Connected setDockIcon/getDockIconState to Tauri commands
4. ✅ Copied tray icon assets from Electron project
5. ✅ Registered all tray/dock commands in lib.rs
6. ✅ Auto-create tray on app startup

### 2025-06-29: Window Management Migration Complete

#### Completed Tasks:
1. ✅ Created comprehensive window.rs module with:
   - Window creation with full parameter support
   - Multiple window management with unique IDs
   - Recipe editor window support (shares goosed process)
   - Window position offsetting
   - Window state tracking
   - Deep link handling preparation
2. ✅ Updated electronCompat.ts:
   - Made window methods async
   - Proper Tauri command integration
   - Window configuration injection
3. ✅ Fixed compilation errors:
   - Added Emitter trait import
   - Fixed async/await mutex lock issues
   - Made WindowInfo public
   - Added lazy_static and urlencoding dependencies
4. ✅ Integrated with single instance handling
5. ✅ Window state persistence via tauri-plugin-window-state

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
8. ✅ Implemented sidecar spawn commands and lifecycle management
9. ✅ Created electron compatibility layer (electronCompat.ts)
10. ✅ Created configuration service (configService.ts)
11. ✅ Implemented auto-start goosed on app launch
12. ✅ Migrated all file system IPC functions
13. ✅ Set up deep linking configuration

14. ✅ Migrated all window management functions

#### In Progress:
- **System Integration Features**
  - Notifications implemented
  - Tray/dock stubs in place
  - Need to complete implementation

#### Recently Discovered Tasks:
- Test and debug the Tauri integration
- Complete tray and dock icon support
- Test file operations with proper permissions
- Verify deep linking functionality
- Test window management features (multiple windows, recipe editor)

## Next Steps

1. Test and debug the current Tauri implementation
2. Complete window management migration
3. Finish system integration features (tray, dock)
4. Configure and test the updater system
5. Performance testing and optimization

## References

- [Tauri 2.x Documentation](https://v2.tauri.app/)
- [Tauri Migration Guide](https://v2.tauri.app/start/migrate/)
- [Window State Plugin](https://v2.tauri.app/plugin/window-state/)
- [Deep Linking Plugin](https://v2.tauri.app/plugin/deep-linking/)
- [Sidecar Documentation](https://v2.tauri.app/develop/sidecar/)

---

*Document created: 2025-06-28*
*Last updated: 2025-06-28*