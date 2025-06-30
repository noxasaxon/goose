// Configuration service that works with both Tauri and Electron

interface AppConfig {
  GOOSE_API_HOST: string;
  GOOSE_PORT: number | null;
  secretKey: string;
}

class ConfigService {
  private config: AppConfig | null = null;
  private isTauri: boolean = false;
  private initialConfigLoaded: boolean = false;

  constructor() {
    // Check if we're running in Tauri
    this.isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
    // Try to load initial config synchronously if available
    this.loadInitialConfig();
  }

  private loadInitialConfig(): void {
    // Check if config was injected by Tauri or Electron
    if (window.appConfig) {
      try {
        // Try to get all config synchronously
        const allConfig = window.appConfig.getAll();
        const config = allConfig as unknown as AppConfig;
        if (config && config.GOOSE_PORT) {
          this.config = config;
          this.initialConfigLoaded = true;
          console.log('Loaded initial config from window.appConfig:', config);
        }
      } catch (error) {
        console.warn('Failed to load initial config from window.appConfig:', error);
      }
    }
  }

  async getConfig(): Promise<AppConfig> {
    // If we have initial config from window injection, use it
    if (this.initialConfigLoaded && this.config) {
      return this.config;
    }

    // In Electron mode, we can use cached config
    if (!this.isTauri && this.config) {
      return this.config;
    }

    if (this.isTauri) {
      // Running in Tauri - use invoke to get config
      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // First check if goosed is already running
        let goosedState = await invoke<{ port: number; working_dir: string } | null>(
          'get_goosed_state'
        );

        // If not running, start it
        if (!goosedState) {
          goosedState = await invoke<{ port: number; working_dir: string }>('start_goosed', {
            workingDir: '.',
          });
        }

        // Now get the app config with the port
        const tauriConfig = await invoke<AppConfig>('get_app_config');

        // Store the working directory in appConfig for UI components
        if (goosedState?.working_dir && window.appConfig) {
          window.appConfig.set('GOOSE_WORKING_DIR', goosedState.working_dir);
        }

        this.config = tauriConfig;
        return tauriConfig;
      } catch (error) {
        console.error('Failed to get Tauri config:', error);
        // Return fallback config instead of throwing
        this.config = {
          GOOSE_API_HOST: 'http://127.0.0.1',
          GOOSE_PORT: 3000,
          secretKey: 'dev-secret-key',
        };
        return this.config;
      }
    } else if (typeof window !== 'undefined' && window.appConfig) {
      // Running in Electron - use window.appConfig
      this.config = {
        GOOSE_API_HOST: (window.appConfig.get('GOOSE_API_HOST') as string) || 'http://127.0.0.1',
        GOOSE_PORT: (window.appConfig.get('GOOSE_PORT') as number) || null,
        secretKey: (window.appConfig.get('secretKey') as string) || '',
      };
      return this.config;
    } else {
      // Fallback for development or other environments
      this.config = {
        GOOSE_API_HOST: 'http://127.0.0.1',
        GOOSE_PORT: 3000,
        secretKey: 'dev-secret-key',
      };
      return this.config;
    }
  }

  async get(key: keyof AppConfig): Promise<string | number | null> {
    const config = await this.getConfig();
    return config[key];
  }

  async getApiUrl(): Promise<string> {
    // If we have initial config, return immediately
    if (this.initialConfigLoaded && this.config) {
      const port = this.config.GOOSE_PORT || 3000;
      return Promise.resolve(`${this.config.GOOSE_API_HOST}:${port}`);
    }

    const config = await this.getConfig();
    const port = config.GOOSE_PORT || 3000; // Default to 3000 if not configured
    return `${config.GOOSE_API_HOST}:${port}`;
  }

  // Synchronous version for immediate access
  getApiUrlSync(): string | null {
    if (this.config && this.config.GOOSE_PORT) {
      const port = this.config.GOOSE_PORT || 3000;
      return `${this.config.GOOSE_API_HOST}:${port}`;
    }
    return null;
  }

  async getSecretKey(): Promise<string> {
    // If we have initial config, return immediately
    if (this.initialConfigLoaded && this.config) {
      return Promise.resolve(this.config.secretKey);
    }

    const config = await this.getConfig();
    return config.secretKey;
  }

  // Synchronous version for immediate access
  getSecretKeySync(): string | null {
    if (this.config && this.config.secretKey) {
      return this.config.secretKey;
    }
    return null;
  }

  isTauriApp(): boolean {
    return this.isTauri;
  }

  clearCache(): void {
    this.config = null;
  }
}

// Export a singleton instance
export const configService = new ConfigService();

// Type declaration for TypeScript
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
