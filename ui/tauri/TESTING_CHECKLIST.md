# Tauri Migration Testing Checklist

## 1. Basic App Launch Test ✅
- [x] Tauri app launches successfully
- [x] React app loads (Vite server running)
- [x] Goosed starts automatically (port 61017)
- [x] Window displays properly

## 2. Window Management Tests
- [x] Creating multiple windows (Cmd+N) - Working
- [x] Window dragging and positioning - Fixed with Transparent style
- [ ] Window state persistence (size/position)
- [ ] Hide/show window functionality

## 3. File System Operations Tests
- [x] Directory chooser dialog - Working
- [x] File selection dialog - Fixed permission issue
- [x] Reading files - Working
- [x] Writing files - Working
- [x] Creating directories - Working
- [ ] Listing files

## 4. Configuration Tests
- [ ] appConfig is working
- [ ] Window config is properly injected
- [ ] Configuration persistence between windows

## 5. UI Component Tests
- [ ] Notifications working
- [ ] All buttons and UI elements functional
- [ ] Working directory displays correctly

## 6. Deep Linking Test
- [ ] goose:// URL handling

## Issues Found & Fixed
1. **Window Dragging** - Fixed by switching to Transparent title bar style
2. **Multiple Windows** - Fixed by reusing existing goosed instance
3. **File Dialog Permissions** - Fixed by adding "chat-*" to windows permissions in capabilities/default.json

## Notes
- Using single shared goosed instance for all windows (differs from Electron)
- Window drag region increased to 52px for better usability