# Goose Icons and Images Documentation

This document provides a comprehensive list of all icons, logos, and image assets used in the Electron version of Goose that need to be migrated to the Tauri version.

## 1. Main Application Icons

Located in `/src/images/`:

| File | Description | Usage |
|------|-------------|--------|
| `icon.png` | Main app icon (standard resolution) | General app icon |
| `icon@2x.png` | Main app icon (2x resolution) | Retina displays |
| `icon.svg` | Main app icon (vector format) | Scalable contexts |
| `icon.ico` | Windows app icon | Windows executable |
| `icon.icns` | macOS app icon | macOS app bundle |

## 2. Tray/Menu Bar Icons

Located in `/src/images/`:

| File | Description | Platform | Notes |
|------|-------------|----------|--------|
| `iconTemplate.png` | macOS tray icon (normal) | macOS | Template image for light/dark mode |
| `iconTemplate@2x.png` | macOS tray icon 2x (normal) | macOS | High DPI displays |
| `iconTemplateUpdate.png` | macOS tray icon (update available) | macOS | Shows when update is ready |
| `iconTemplateUpdate@2x.png` | macOS tray icon 2x (update) | macOS | High DPI + update state |

## 3. UI/Logo Images

Located in `/src/images/`:

| File | Description | Usage |
|------|-------------|--------|
| `glyph.svg` | Goose glyph/symbol | UI components |
| `Union@2x.svg` | UI element | Interface decoration |

## 4. Loading Animation

Located in `/src/images/loading-goose/`:

- `1.svg` through `7.svg` - Seven SVG frames for the loading goose animation
- Used for loading states throughout the application

## 5. Provider/Service Logos

Located in `/src/components/settings/providers/modal/subcomponents/icons/`:

### Standard Resolution (1x)
- `anthropic.png`
- `databricks.png`
- `default.png` (fallback logo)
- `google.png`
- `groq.png`
- `ollama.png`
- `openai.png`
- `openrouter.png`
- `snowflake.png`

### High Resolution (2x)
- `anthropic@2x.png`
- `databricks@2x.png`
- `default@2x.png`
- `google@2x.png`
- `groq@2x.png`
- `ollama@2x.png`
- `openai@2x.png`
- `openrouter@2x.png`
- `snowflake@2x.png`

### Ultra High Resolution (3x)
- `anthropic@3x.png`
- `databricks@3x.png`
- `default@3x.png`
- `google@3x.png`
- `groq@3x.png`
- `ollama@3x.png`
- `openai@3x.png`
- `openrouter@3x.png`
- `snowflake@3x.png`
- `xai@3x.png`

### Vector Formats
- `openai.svg`

### Special Cases
- `xai.png` (1x resolution)
- `xai@3x.png` (only 3x available)

## 6. Game Assets

Located in `/src/assets/battle-game/`:

| File | Description | Usage |
|------|-------------|--------|
| `background.png` | Battle game background | Easter egg game |
| `goose.png` | Goose character sprite | Battle game character |
| `llama.png` | Llama character sprite | Battle game opponent |

## 7. Other UI Assets

Located in `/src/assets/`:

| File | Description | Usage |
|------|-------------|--------|
| `clock-icon.svg` | Clock icon (vector) | UI timing elements |
| `clock-icon.png` | Clock icon (raster) | UI timing elements |

## 8. SVG Components

These are React components that contain inline SVG:

- **Goose SVG Component** (`/src/components/icons/Goose.tsx`)
  - Contains the Goose logo SVG
  - Contains rain animation SVG
  - Used in LoadingGoose and GooseLogo components

## 9. Icon Configuration in Electron

### Electron Forge Configuration (`forge.config.ts`)
```javascript
icon: 'src/images/icon' // Auto-selects platform-specific format
// Windows specific:
icon: 'src/images/icon.ico'
```

### Window Creation (`main.ts`)
```javascript
icon: path.join(__dirname, '../images/icon')
```

### Extra Resources
Icons are packaged as extra resources:
```javascript
extraResource: ['src/bin', 'src/images']
```

## 10. Platform-Specific Considerations

### macOS
- Uses "template" images for tray icons to support light/dark mode
- Requires .icns format for app icon
- Supports @2x variants for Retina displays

### Windows
- Uses .ico format for app icon
- Tray icons use regular PNG format
- No template image support

### Linux
- Uses PNG format for all icons
- Various sizes may be needed for different desktop environments

## Migration Notes for Tauri

1. **Tray Icons**: Tauri already has the correct icons copied from Electron in `/ui/tauri/src-tauri/icons/`
2. **App Icons**: The main app icons are already in place
3. **Provider Logos**: These are React assets and will work as-is
4. **Loading Animation**: SVG files will work directly in React
5. **Game Assets**: These are React assets and will work as-is
6. **UI Assets**: These will work directly in the React app

### Still Needed
- Ensure all provider logos are accessible in the built Tauri app
- Verify tray icon switching for update states works correctly
- Test icon appearance on all platforms

## File Structure Summary

```
electron/
├── src/
│   ├── images/
│   │   ├── icon.png
│   │   ├── icon@2x.png
│   │   ├── icon.svg
│   │   ├── icon.ico
│   │   ├── icon.icns
│   │   ├── iconTemplate.png
│   │   ├── iconTemplate@2x.png
│   │   ├── iconTemplateUpdate.png
│   │   ├── iconTemplateUpdate@2x.png
│   │   ├── glyph.svg
│   │   ├── Union@2x.svg
│   │   └── loading-goose/
│   │       └── [1-7].svg
│   ├── assets/
│   │   ├── clock-icon.svg
│   │   ├── clock-icon.png
│   │   └── battle-game/
│   │       ├── background.png
│   │       ├── goose.png
│   │       └── llama.png
│   └── components/
│       ├── icons/
│       │   └── Goose.tsx
│       └── settings/providers/modal/subcomponents/icons/
│           └── [provider logos with @1x, @2x, @3x variants]
```

This documentation should help ensure all visual assets are properly migrated to the Tauri version of Goose.