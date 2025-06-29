# Goose Tauri App

This is the Tauri version of the Goose desktop application, providing a lighter and more performant alternative to the Electron version.

## Prerequisites

- Rust 1.78+ (install via rustup)
- Node.js 22.9.0+
- macOS, Windows, or Linux

## Development

To run the app in development mode:

```bash
npm run dev
# or
./dev.sh
```

This will:
1. Start the Vite dev server for the React app
2. Launch the Tauri app in development mode
3. Enable hot reload for both frontend and backend changes

## Building

To build the app for production:

```bash
npm run build
# or
./build.sh
```

This will:
1. Build the React app with Vite
2. Build the Rust backend
3. Create platform-specific bundles (.app, .dmg for macOS)

The built apps will be in `src-tauri/target/release/bundle/`.

## Features

- ✅ System tray/menu bar support with update indicators
- ✅ Dock icon management
- ✅ Settings persistence with tauri-plugin-store
- ✅ Auto-updater with GitHub releases
- ✅ Deep linking (goose:// protocol)
- ✅ File system access
- ✅ All provider integrations
- ✅ Window state persistence

## Architecture

The Tauri app shares the same React frontend as the Electron version, located in `../desktop/`. The Rust backend provides:

- Native system integration
- Sidecar process management (goosed)
- Settings and state management
- Update checking and installation
- Window and tray management

## Troubleshooting

### Dev server not starting
If you see "Waiting for your frontend dev server to start", make sure:
1. You're running from the `ui/tauri` directory
2. The desktop app dependencies are installed: `cd ../desktop && npm install`
3. No other process is using port 5173

### Build errors
If the build fails with "Unable to find your web assets":
1. Make sure to build the frontend first: `cd ../desktop && npm run build:vite`
2. Or use the build script: `./build.sh`

### Icons not appearing
All icons are bundled from the shared desktop assets. Provider logos are only included if they're actually used in the code (tree-shaking optimization).