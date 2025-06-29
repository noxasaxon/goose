#!/bin/bash

# Build script for Tauri app
# This script handles building the web assets before running Tauri build

set -e

echo "Building Tauri app..."

# Save current directory
TAURI_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$TAURI_DIR/../desktop"

# Build web assets
echo "Building web assets..."
cd "$DESKTOP_DIR"
npm run build:vite

# Return to tauri directory and build
echo "Building Tauri bundles..."
cd "$TAURI_DIR"
cargo tauri build "$@"

echo "Build complete!"