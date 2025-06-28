// Configuration service that works with both Tauri and Electron

interface AppConfig {
  GOOSE_API_HOST: string;
  GOOSE_PORT: number | null;
  secretKey: string;
}

class ConfigService {
  private config: AppConfig | null = null;
  private isTauri: boolean = false;

  constructor() {
    // Check if we're running in Tauri
    this.isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
  }

  async getConfig(): Promise<AppConfig> {
    if (this.config) {
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
          console.log('Starting goosed...');
          goosedState = await invoke<{ port: number; working_dir: string }>('start_goosed', {
            workingDir: '.',
          });
          console.log('Goosed started on port:', goosedState.port);
        }

        // Now get the app config with the port
        const tauriConfig = await invoke<AppConfig>('get_app_config');
        console.log('Got app config:', tauriConfig);

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
    const config = await this.getConfig();
    const port = config.GOOSE_PORT || 3000; // Default to 3000 if not configured
    return `${config.GOOSE_API_HOST}:${port}`;
  }

  async getSecretKey(): Promise<string> {
    const config = await this.getConfig();
    return config.secretKey;
  }

  isTauriApp(): boolean {
    return this.isTauri;
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
