// Electron compatibility layer for Tauri
// This provides a window.electron object that mimics the Electron API
// but uses Tauri underneath

import { configService } from './configService';

interface ElectronCompatConfig {
  recipeConfig?: unknown;
  query?: string;
  dir?: string;
  view?: string;
  resumeSessionId?: string;
  GOOSE_ALLOWLIST_WARNING?: boolean;
  GOOSE_WORKING_DIR?: string;
}

class ElectronCompat {
  private config: ElectronCompatConfig = {};

  constructor() {
    // Initialize with URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    this.config = {
      view: urlParams.get('view') || undefined,
      resumeSessionId: urlParams.get('resumeSessionId') || undefined,
      query: urlParams.get('query') || undefined,
      dir: urlParams.get('dir') || undefined,
    };
  }

  // Mimic electron's getConfig method
  getConfig(): ElectronCompatConfig {
    return this.config;
  }

  // Stub for logInfo - in Tauri we'll just console.log
  logInfo(message: string): void {
    console.log('[Info]', message);
  }

  // Stub for other electron methods that might be called
  async hideWindow(): Promise<void> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      try {
        await invoke('hide_window', { window: getCurrentWindow() });
      } catch (error) {
        console.error('Failed to hide window:', error);
      }
    }
  }

  async createChatWindow(
    query?: string,
    dir?: string,
    version?: string,
    resumeSessionId?: string,
    recipeConfig?: unknown,
    viewType?: string
  ): Promise<void> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('create_chat_window', {
          options: {
            query,
            dir,
            version,
            resume_session_id: resumeSessionId,
            recipe_config: recipeConfig,
            view_type: viewType,
          },
        });
      } catch (error) {
        console.error('Failed to create chat window:', error);
      }
    }
  }

  showNotification(data: { title: string; body: string }): void {
    // Use Tauri's notification API
    if (configService.isTauriApp()) {
      import('@tauri-apps/plugin-notification').then(({ sendNotification }) => {
        sendNotification({
          title: data.title,
          body: data.body,
        });
      });
    }
  }

  async directoryChooser(replace?: boolean): Promise<{ filePaths: string[]; canceled: boolean }> {
    if (configService.isTauriApp()) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        directory: true,
        multiple: false,
      });

      if (result) {
        const newDir = result as string;
        // Update the working directory in appConfig
        if (window.appConfig) {
          window.appConfig.set('GOOSE_WORKING_DIR', newDir);
        }

        // Add to recent directories
        await this.addRecentDir(newDir);

        // If replace is true, we should restart goosed with the new directory
        if (replace) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            // Stop existing goosed
            await invoke('stop_goosed');
            // Start with new directory
            await invoke('start_goosed', { workingDir: newDir });
            console.log('Goosed restarted with new working directory:', newDir);

            // Reload the window to pick up the new configuration
            window.location.reload();
          } catch (error) {
            console.error('Failed to restart goosed with new directory:', error);
          }
        }
      }

      return {
        filePaths: result ? [result as string] : [],
        canceled: !result,
      };
    }
    return { filePaths: [], canceled: true };
  }

  async showMessageBox(options: {
    message: string;
    title?: string;
    type?: string;
    buttons?: string[];
    defaultId?: number;
    detail?: string;
  }): Promise<{ response: number }> {
    if (configService.isTauriApp()) {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const result = await ask(options.message, {
        title: options.title,
        // type: options.type, // Tauri dialog doesn't support type
      });
      return { response: result ? 0 : 1 };
    }
    return { response: 0 };
  }

  // Add other methods as needed...

  platform: string = 'darwin'; // Default to macOS, should detect actual platform

  async reactReady(): Promise<void> {
    console.log('React ready');
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        // Notify Tauri that React is ready (handles pending deep links)
        await invoke('react_ready');

        // Get window config from Tauri window
        if (window.__tauriWindowConfig) {
          // Update appConfig with window-specific values
          if (window.appConfig) {
            window.appConfig.set('GOOSE_PORT', window.__tauriWindowConfig.GOOSE_PORT);
            window.appConfig.set('GOOSE_WORKING_DIR', window.__tauriWindowConfig.GOOSE_WORKING_DIR);
            if (window.__tauriWindowConfig.recipeConfig) {
              window.appConfig.set('recipeConfig', window.__tauriWindowConfig.recipeConfig);
            }
          }
        }

        // Get and cache app version
        try {
          const version = await invoke<string>('get_app_version');
          if (window.appConfig) {
            window.appConfig.set('APP_VERSION', version);
          }
        } catch (error) {
          console.error('Failed to get app version:', error);
        }
      } catch (error) {
        console.error('Failed to notify react ready:', error);
      }
    }
  }

  openInChrome(url: string): void {
    if (configService.isTauriApp()) {
      import('@tauri-apps/plugin-shell').then(({ open }) => {
        open(url);
      });
    }
  }

  reloadApp(): void {
    window.location.reload();
  }

  async selectFileOrDirectory(): Promise<string | null> {
    if (configService.isTauriApp()) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        directory: false,
        multiple: false,
      });
      return result as string | null;
    }
    return null;
  }

  // Stubs for features not yet implemented
  async checkForOllama(): Promise<boolean> {
    return false;
  }

  async fetchMetadata(_url: string): Promise<string> {
    return '';
  }

  async startPowerSaveBlocker(): Promise<number> {
    return 0;
  }

  async stopPowerSaveBlocker(): Promise<void> {
    // No-op
  }

  async getBinaryPath(binaryName: string): Promise<string> {
    return binaryName;
  }

  async readFile(
    filePath: string
  ): Promise<{ file: string; filePath: string; error: string | null; found: boolean }> {
    if (configService.isTauriApp()) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      try {
        const content = await readTextFile(filePath);
        return { file: content, filePath, error: null, found: true };
      } catch (error) {
        return {
          file: '',
          filePath,
          error: error instanceof Error ? error.toString() : String(error),
          found: false,
        };
      }
    }
    return { file: '', filePath, error: 'Not implemented', found: false };
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      try {
        await writeTextFile(filePath, content);
        return true;
      } catch (error) {
        console.error('Failed to write file:', error);
        return false;
      }
    }
    return false;
  }

  async ensureDirectory(dirPath: string): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { mkdir } = await import('@tauri-apps/plugin-fs');
      try {
        await mkdir(dirPath, { recursive: true });
        return true;
      } catch (error) {
        console.error('Failed to create directory:', error);
        return false;
      }
    }
    return false;
  }

  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    if (configService.isTauriApp()) {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      try {
        const entries = await readDir(dirPath);
        let files = entries.filter((entry) => entry.isFile).map((entry) => entry.name);

        if (extension) {
          files = files.filter((name) => name.endsWith(extension));
        }

        return files;
      } catch (error) {
        console.error('Failed to list files:', error);
        return [];
      }
    }
    return [];
  }

  getPathForFile(file: File): string {
    // In Tauri, we don't have direct access to file paths from File objects
    return file.name;
  }

  async getAllowedExtensions(): Promise<string[]> {
    return ['.txt', '.md', '.json', '.yaml', '.yml'];
  }

  // Settings related methods
  async setMenuBarIcon(show: boolean): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        return await invoke('set_menu_bar_icon', { show });
      } catch (error) {
        console.error('Failed to set menu bar icon:', error);
        return false;
      }
    }
    return true;
  }

  async getMenuBarIconState(): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        return await invoke('get_menu_bar_icon_state');
      } catch (error) {
        console.error('Failed to get menu bar icon state:', error);
        return true;
      }
    }
    return true;
  }

  async setDockIcon(show: boolean): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        return await invoke('set_dock_icon', { show });
      } catch (error) {
        console.error('Failed to set dock icon:', error);
        return false;
      }
    }
    return true;
  }

  async getDockIconState(): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        return await invoke('get_dock_icon_state');
      } catch (error) {
        console.error('Failed to get dock icon state:', error);
        return true;
      }
    }
    return true;
  }

  async getSettings(): Promise<unknown> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const settings = await invoke<{
          showMenuBarIcon: boolean;
          showDockIcon: boolean;
          showQuitConfirmation: boolean;
          schedulingEngine: string;
          gooseServerMemory: boolean;
          gooseServerComputerController: boolean;
        }>('get_settings');
        // Convert to match the expected format
        return {
          envToggles: {
            GOOSE_SERVER__MEMORY: settings.gooseServerMemory,
            GOOSE_SERVER__COMPUTER_CONTROLLER: settings.gooseServerComputerController,
          },
          showMenuBarIcon: settings.showMenuBarIcon,
          showDockIcon: settings.showDockIcon,
          schedulingEngine: settings.schedulingEngine,
          showQuitConfirmation: settings.showQuitConfirmation,
        };
      } catch (error) {
        console.error('Failed to get settings:', error);
      }
    }
    return {
      envToggles: {},
      showMenuBarIcon: true,
      showDockIcon: true,
      schedulingEngine: 'disabled',
      showQuitConfirmation: false,
    };
  }

  async setSchedulingEngine(engine: string): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('set_setting', {
          key: 'schedulingEngine',
          value: engine,
        });
        return true;
      } catch (error) {
        console.error('Failed to set scheduling engine:', error);
        return false;
      }
    }
    return true;
  }

  async setQuitConfirmation(show: boolean): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('set_setting', {
          key: 'showQuitConfirmation',
          value: show,
        });
        return true;
      } catch (error) {
        console.error('Failed to set quit confirmation:', error);
        return false;
      }
    }
    return true;
  }

  async getQuitConfirmationState(): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const value = await invoke('get_setting', { key: 'showQuitConfirmation' });
        return value as boolean;
      } catch (error) {
        console.error('Failed to get quit confirmation state:', error);
        return false;
      }
    }
    return false;
  }

  async openNotificationsSettings(): Promise<boolean> {
    return true;
  }

  // Environment toggles
  async setEnvToggle(key: string, value: boolean): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('set_setting', { key, value });
        return true;
      } catch (error) {
        console.error('Failed to set env toggle:', error);
        return false;
      }
    }
    return true;
  }

  async getEnvToggle(key: string): Promise<boolean> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const value = await invoke('get_setting', { key });
        return value as boolean;
      } catch (error) {
        console.error('Failed to get env toggle:', error);
        return false;
      }
    }
    return false;
  }

  // Recent directories
  async getRecentDirs(): Promise<string[]> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        return await invoke('get_recent_dirs');
      } catch (error) {
        console.error('Failed to get recent dirs:', error);
        return [];
      }
    }
    return [];
  }

  async addRecentDir(directory: string): Promise<string[]> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        return await invoke('add_recent_dir', { directory });
      } catch (error) {
        console.error('Failed to add recent dir:', error);
        return [];
      }
    }
    return [];
  }

  async clearRecentDirs(): Promise<void> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('clear_recent_dirs');
      } catch (error) {
        console.error('Failed to clear recent dirs:', error);
      }
    }
  }

  // Event handling - store callbacks to simulate Electron IPC
  private eventCallbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  on(channel: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventCallbacks.has(channel)) {
      this.eventCallbacks.set(channel, new Set());
    }
    this.eventCallbacks.get(channel)!.add(callback);
  }

  off(channel: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.eventCallbacks.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(channel: string, ...args: unknown[]): void {
    console.log(`Event emitted: ${channel}`, args);
  }

  // Image handling
  async saveDataUrlToTemp(
    _dataUrl: string,
    uniqueId: string
  ): Promise<{ id: string; error?: string; filePath?: string }> {
    return { id: uniqueId, error: 'Not implemented' };
  }

  deleteTempFile(_filePath: string): void {
    console.log('Delete temp file:', _filePath);
  }

  async getTempImage(_filePath: string): Promise<string | null> {
    return null;
  }

  // Update related
  getVersion(): string {
    if (configService.isTauriApp() && window.appConfig) {
      const version = window.appConfig.get('APP_VERSION');
      if (version) return version as string;
    }
    return '1.0.0';
  }

  async checkForUpdates(): Promise<{ updateInfo: unknown; error: string | null }> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const updateInfo = await invoke('check_for_update');
        return {
          updateInfo,
          error: null,
        };
      } catch (error) {
        return {
          updateInfo: null,
          error: error instanceof Error ? error.toString() : String(error),
        };
      }
    }
    return { updateInfo: null, error: 'Not in Tauri' };
  }

  async downloadUpdate(): Promise<{ success: boolean; error: string | null }> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const success = await invoke<boolean>('download_update');
        return { success, error: null };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.toString() : String(error),
        };
      }
    }
    return { success: false, error: 'Not in Tauri' };
  }

  installUpdate(): void {
    if (configService.isTauriApp()) {
      import('@tauri-apps/api/core').then(async ({ invoke }) => {
        try {
          // Install the update
          await invoke('install_update');
          // After successful installation, relaunch the app
          await invoke('relaunch_app');
        } catch (error) {
          console.error('Failed to install update:', error);
        }
      });
    }
  }

  restartApp(): void {
    if (configService.isTauriApp()) {
      import('@tauri-apps/plugin-process').then(({ relaunch }) => {
        relaunch();
      });
    }
  }

  onUpdaterEvent(callback: (event: unknown) => void): void {
    if (configService.isTauriApp()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        // Listen for various updater events
        listen('updater://update-available', (event) => {
          callback({ type: 'update-available', data: event.payload });
        });
        listen('updater://download-started', () => {
          callback({ type: 'download-started' });
        });
        listen('updater://download-progress', (event) => {
          callback({ type: 'download-progress', progress: event.payload });
        });
        listen('updater://download-complete', () => {
          callback({ type: 'download-complete' });
        });
        listen('updater://download-error', (event) => {
          callback({ type: 'download-error', error: event.payload });
        });
        listen('updater://install-started', () => {
          callback({ type: 'install-started' });
        });
        listen('updater://install-error', (event) => {
          callback({ type: 'install-error', error: event.payload });
        });
      });
    }
  }

  async getUpdateState(): Promise<{ updateAvailable: boolean; latestVersion?: string } | null> {
    if (configService.isTauriApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const state = await invoke<{
          version: string;
          available: boolean;
          downloaded: boolean;
          notes?: string;
          pub_date?: string;
        } | null>('get_update_state');

        if (state) {
          return {
            updateAvailable: state.available,
            latestVersion: state.version,
          };
        }
      } catch (error) {
        console.error('Failed to get update state:', error);
      }
    }
    return null;
  }
}

// Create and install the compatibility layer
const electronCompat = new ElectronCompat();

// Create appConfig compatibility layer
class AppConfigCompat {
  private configCache: Map<string, unknown> = new Map();

  constructor() {
    // Pre-populate with common values
    this.loadInitialConfig();
  }

  private async loadInitialConfig() {
    try {
      // In Tauri mode, working directory is handled by goosed state
      // Only try to load from backend API in Electron mode
      if (!configService.isTauriApp()) {
        // Load common config values
        const { readConfig } = await import('../api');

        // Try to load working directory
        try {
          const dir = await readConfig({ body: { key: 'GOOSE_WORKING_DIR', is_secret: false } });
          if (dir.data) {
            this.configCache.set('GOOSE_WORKING_DIR', dir.data);
          }
        } catch (error) {
          console.log('Could not load GOOSE_WORKING_DIR');
        }
      }

      // Recipe config comes from window.electron.getConfig()
      const electronConfig = electronCompat.getConfig();
      if (electronConfig?.recipeConfig) {
        this.configCache.set('recipeConfig', electronConfig.recipeConfig);
      }
    } catch (error) {
      console.warn('Failed to load initial appConfig:', error);
    }
  }

  get(key: string): unknown {
    // Special handling for recipeConfig - always get fresh from electron
    if (key === 'recipeConfig') {
      const electronConfig = electronCompat.getConfig();
      return electronConfig?.recipeConfig;
    }

    // Special handling for GOOSE_WORKING_DIR to prevent 'undefined' display
    if (key === 'GOOSE_WORKING_DIR') {
      const value = this.configCache.get(key);
      return value || '.';
    }

    // Return cached value or undefined
    return this.configCache.get(key);
  }

  set(key: string, value: unknown): void {
    this.configCache.set(key, value);
  }

  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Add all cached values
    this.configCache.forEach((value, key) => {
      result[key] = value;
    });

    // Always include fresh recipeConfig if available
    const electronConfig = electronCompat.getConfig();
    if (electronConfig?.recipeConfig) {
      result.recipeConfig = electronConfig.recipeConfig;
    }

    // Ensure GOOSE_WORKING_DIR has a default value
    if (!result.GOOSE_WORKING_DIR) {
      result.GOOSE_WORKING_DIR = '.';
    }

    // Ensure required AppConfig properties are present with defaults
    if (!result.GOOSE_API_HOST) {
      result.GOOSE_API_HOST = 'http://127.0.0.1';
    }
    if (result.GOOSE_PORT === undefined) {
      result.GOOSE_PORT = null;
    }
    if (!result.secretKey) {
      result.secretKey = '';
    }

    return result;
  }
}

const appConfigCompat = new AppConfigCompat();

// Install on window object if it doesn't exist
if (typeof window !== 'undefined') {
  if (!window.electron) {
    window.electron = electronCompat;
  }
  if (!window.appConfig) {
    window.appConfig = appConfigCompat;
  }
}

// Type declaration for TypeScript
declare global {
  interface Window {
    electron: ElectronCompat;
    appConfig: AppConfigCompat;
    __TAURI_INTERNALS__?: unknown;
    __tauriWindowConfig?: {
      GOOSE_PORT: number;
      GOOSE_WORKING_DIR: string;
      recipeConfig?: unknown;
    };
  }
}

export { electronCompat };
