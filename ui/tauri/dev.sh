#!/bin/bash

# Development script for Tauri app
# This script handles starting the dev server before running Tauri dev

set -e

echo "Starting Tauri development server..."

# Save current directory
TAURI_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$TAURI_DIR/../desktop"

# Function to cleanup on exit
cleanup() {
    echo "Stopping dev server..."
    # Kill the dev server if it's running
    if [ ! -z "$DEV_SERVER_PID" ]; then
        kill $DEV_SERVER_PID 2>/dev/null || true
    fi
}

# Set up cleanup on exit
trap cleanup EXIT

# Start dev server in background
echo "Starting Vite dev server..."
cd "$DESKTOP_DIR"
npm run dev:vite &
DEV_SERVER_PID=$!

# Wait for dev server to be ready
echo "Waiting for dev server to start..."
while ! curl -s http://localhost:5173 > /dev/null; do
    sleep 1
done
echo "Dev server is ready!"

# Return to tauri directory and run dev
cd "$TAURI_DIR"
cargo tauri dev "$@"