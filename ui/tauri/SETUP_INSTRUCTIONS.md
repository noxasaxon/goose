# Tauri Setup Instructions

Follow these steps to get the Tauri app running from a fresh clone:

## Prerequisites
- Node.js (v18 or higher)
- Rust (latest stable)
- Tauri CLI

## Setup Steps

1. **Clone the repository and checkout the branch**
   ```bash
   git clone <repo-url>
   cd goose
   git checkout noxasaxon-tauri
   ```

2. **Install Rust dependencies**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

3. **Install Tauri CLI**
   ```bash
   cargo install tauri-cli
   ```

4. **Install frontend dependencies**
   ```bash
   cd ui/desktop
   npm install
   ```

5. **Install Tauri plugin packages**
   ```bash
   npm install @tauri-apps/api @tauri-apps/plugin-notification @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-shell @tauri-apps/plugin-updater @tauri-apps/plugin-process
   ```

6. **Build the frontend**
   ```bash
   npm run build:vite
   ```

7. **Run the Tauri app**
   ```bash
   cd ../tauri
   cargo tauri dev
   ```

## Troubleshooting

### Missing Tauri plugins error
If you see errors about missing `@tauri-apps/*` packages, make sure you ran step 5 above.

### Port already in use
If port 5173 is already in use:
```bash
lsof -ti:5173 | xargs kill -9
```

### Goosed binary not found
Make sure the goosed binary exists at `ui/tauri/src-tauri/binaries/goosed-[target]/goosed[.exe]`