#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Determine the platform and architecture
const platform = process.platform;
const arch = process.arch;

// Map Node.js platform/arch to Rust target triples
function getRustTriple() {
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  } else if (platform === 'win32') {
    return 'x86_64-pc-windows-msvc';
  } else if (platform === 'linux') {
    return 'x86_64-unknown-linux-gnu';
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

const rustTriple = getRustTriple();
const ext = platform === 'win32' ? '.exe' : '';

// Paths
const projectRoot = path.join(__dirname, '..', '..', '..');
const sourcePath = path.join(projectRoot, 'target', 'release', `goosed${ext}`);
const targetDir = path.join(__dirname, '..', 'src-tauri', 'binaries');
const targetPath = path.join(targetDir, `goosed-${rustTriple}${ext}`);

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Check if source exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Source binary not found at: ${sourcePath}`);
  console.error('Please build the goosed binary first with: cargo build --release -p goose-server');
  process.exit(1);
}

// Copy the binary with platform-specific name
console.log(`Copying ${sourcePath} to ${targetPath}`);
fs.copyFileSync(sourcePath, targetPath);

// Make it executable on Unix-like systems
if (platform !== 'win32') {
  fs.chmodSync(targetPath, '755');
}

console.log(`✅ Sidecar prepared: goosed-${rustTriple}${ext}`);