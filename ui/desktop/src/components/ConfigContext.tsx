import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  readAllConfig,
  removeConfig,
  upsertConfig,
  getExtensions as apiGetExtensions,
  addExtension as apiAddExtension,
  removeExtension as apiRemoveExtension,
  providers,
} from '../api';
import { client } from '../api/client.gen';
import type {
  ConfigResponse,
  UpsertConfigQuery,
  ConfigKeyQuery,
  ExtensionResponse,
  ProviderDetails,
  ExtensionQuery,
  ExtensionConfig,
} from '../api/types.gen';
import { removeShims } from './settings/extensions/utils';
import { configService } from '../services/configService';

export type { ExtensionConfig } from '../api/types.gen';

// Define a local version that matches the structure of the imported one
export type FixedExtensionEntry = ExtensionConfig & {
  enabled: boolean;
};

interface ConfigContextType {
  config: ConfigResponse['config'];
  providersList: ProviderDetails[];
  extensionsList: FixedExtensionEntry[];
  upsert: (key: string, value: unknown, is_secret: boolean) => Promise<void>;
  read: (key: string, is_secret: boolean) => Promise<unknown>;
  remove: (key: string, is_secret: boolean) => Promise<void>;
  addExtension: (name: string, config: ExtensionConfig, enabled: boolean) => Promise<void>;
  toggleExtension: (name: string) => Promise<void>;
  removeExtension: (name: string) => Promise<void>;
  getProviders: (b: boolean) => Promise<ProviderDetails[]>;
  getExtensions: (b: boolean) => Promise<FixedExtensionEntry[]>;
  disableAllExtensions: () => Promise<void>;
  enableBotExtensions: (extensions: ExtensionConfig[]) => Promise<void>;
  refreshApiClient: () => Promise<void>;
}

interface ConfigProviderProps {
  children: React.ReactNode;
}

export class MalformedConfigError extends Error {
  constructor() {
    super('Check contents of ~/.config/goose/config.yaml');
    this.name = 'MalformedConfigError';
    Object.setPrototypeOf(this, MalformedConfigError.prototype);
  }
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<ConfigResponse['config']>({});
  const [providersList, setProvidersList] = useState<ProviderDetails[]>([]);
  const [extensionsList, setExtensionsList] = useState<FixedExtensionEntry[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshApiClient = useCallback(async () => {
    try {
      // Clear cached config to force fresh fetch
      configService.clearCache();

      // Get fresh configuration from configService
      const apiUrl = await configService.getApiUrl();
      const secretKey = await configService.getSecretKey();

      client.setConfig({
        baseUrl: apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': secretKey,
        },
      });

      // Give the client a moment to update
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to refresh API client:', error);
      throw error;
    }
  }, []);

  const reloadConfig = useCallback(async () => {
    // Get fresh config for each request
    const apiUrl = await configService.getApiUrl();
    const secretKey = await configService.getSecretKey();

    const response = await readAllConfig({
      baseUrl: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Secret-Key': secretKey,
      },
    });

    // Check if the response has an error (hey-api style)
    if (response.error) {
      const error = {
        response: response.response,
        error: response.error,
        message: 'Failed to read all config',
      };
      throw error;
    }

    setConfig(response.data?.config || {});
  }, []);

  const upsert = useCallback(
    async (key: string, value: unknown, isSecret: boolean = false) => {
      const query: UpsertConfigQuery = {
        key: key,
        value: value,
        is_secret: isSecret,
      };
      // Get fresh config for each request
      const apiUrl = await configService.getApiUrl();
      const secretKey = await configService.getSecretKey();

      await upsertConfig({
        body: query,
        baseUrl: apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': secretKey,
        },
      });
      await reloadConfig();
    },
    [reloadConfig]
  );

  const read = useCallback(
    async (key: string, is_secret: boolean = false) => {
      const query: ConfigKeyQuery = { key: key, is_secret: is_secret };

      try {
        // Get fresh config for each request
        const apiUrl = await configService.getApiUrl();
        const secretKey = await configService.getSecretKey();

        // Use direct fetch since the SDK seems to have issues
        const response = await fetch(`${apiUrl}/config/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': secretKey,
          },
          body: JSON.stringify(query),
        });

        if (!response.ok) {
          // 404 means the key doesn't exist, which is a valid case
          if (response.status === 404) {
            return null;
          }
          const error = {
            response,
            error: {},
            message: `Config read failed for key ${key}`,
          };
          throw error;
        }

        const data = await response.json();
        return data;
      } catch (error: unknown) {
        // Check if this is an error from the hey-api client
        const errorObj = error as { response?: { status?: number }; status?: number };
        const isApiError = errorObj?.response?.status !== undefined;
        const status = isApiError ? errorObj.response?.status : errorObj?.status;

        // Only log errors for non-404 status codes
        if (status !== 404) {
          console.error(`readConfig failed for key ${key} with status ${status}`);
        }

        // Special handling for 404 - key doesn't exist
        if (status === 404) {
          return null;
        }

        // In Tauri mode, if we get other errors, try refreshing the API client once
        if (configService.isTauriApp() && (status === 401 || status === 0 || !status)) {
          console.warn(`Got error for config key '${key}', refreshing API client and retrying...`);
          await refreshApiClient();

          // Retry with fresh config
          const apiUrl = await configService.getApiUrl();
          const secretKey = await configService.getSecretKey();

          const retryResponse = await fetch(`${apiUrl}/config/read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Secret-Key': secretKey,
            },
            body: JSON.stringify(query),
          });

          if (!retryResponse.ok) {
            // 404 on retry also means key doesn't exist
            if (retryResponse.status === 404) {
              return null;
            }
            const error = {
              response: retryResponse,
              error: {},
              message: `Config read retry failed for key ${key}`,
            };
            throw error;
          }

          const data = await retryResponse.json();
          return data;
        }
        throw error;
      }
    },
    [refreshApiClient]
  );

  const remove = useCallback(
    async (key: string, is_secret: boolean) => {
      const query: ConfigKeyQuery = { key: key, is_secret: is_secret };
      // Get fresh config for each request
      const apiUrl = await configService.getApiUrl();
      const secretKey = await configService.getSecretKey();

      await removeConfig({
        body: query,
        baseUrl: apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': secretKey,
        },
      });
      await reloadConfig();
    },
    [reloadConfig]
  );

  const addExtension = useCallback(
    async (name: string, config: ExtensionConfig, enabled: boolean) => {
      // remove shims if present
      if (config.type === 'stdio') {
        config.cmd = removeShims(config.cmd);
      }
      const query: ExtensionQuery = { name, config, enabled };
      // Get fresh config for each request
      const apiUrl = await configService.getApiUrl();
      const secretKey = await configService.getSecretKey();

      await apiAddExtension({
        body: query,
        baseUrl: apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': secretKey,
        },
      });
      await reloadConfig();
    },
    [reloadConfig]
  );

  const removeExtension = useCallback(
    async (name: string) => {
      // Get fresh config for each request
      const apiUrl = await configService.getApiUrl();
      const secretKey = await configService.getSecretKey();

      await apiRemoveExtension({
        path: { name: name },
        baseUrl: apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': secretKey,
        },
      });
      await reloadConfig();
    },
    [reloadConfig]
  );

  const getExtensions = useCallback(
    async (forceRefresh = false): Promise<FixedExtensionEntry[]> => {
      if (forceRefresh || extensionsList.length === 0) {
        // Get fresh config for each request
        const apiUrl = await configService.getApiUrl();
        const secretKey = await configService.getSecretKey();

        const result = await apiGetExtensions({
          baseUrl: apiUrl,
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': secretKey,
          },
        });

        if (result.response.status === 422) {
          throw new MalformedConfigError();
        }

        if (result.error && !result.data) {
          console.log(result.error);
          return extensionsList;
        }

        const extensionResponse: ExtensionResponse = result.data!;
        setExtensionsList(extensionResponse.extensions);
        return extensionResponse.extensions;
      }
      return extensionsList;
    },
    [extensionsList]
  );

  const toggleExtension = useCallback(
    async (name: string) => {
      const exts = await getExtensions(true);
      const extension = exts.find((ext) => ext.name === name);

      if (extension) {
        await addExtension(name, extension, !extension.enabled);
      }
    },
    [addExtension, getExtensions]
  );

  const getProviders = useCallback(
    async (forceRefresh = false): Promise<ProviderDetails[]> => {
      if (forceRefresh || providersList.length === 0) {
        // Get fresh config for each request
        const apiUrl = await configService.getApiUrl();
        const secretKey = await configService.getSecretKey();

        const response = await providers({
          baseUrl: apiUrl,
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': secretKey,
          },
        });
        setProvidersList(response.data || []);
        return response.data || [];
      }
      return providersList;
    },
    [providersList]
  );

  useEffect(() => {
    // Initialize client and load all configuration data on mount
    (async () => {
      try {
        // Initialize the API client with configuration from configService
        await refreshApiClient();

        setIsInitialized(true);

        // Load config
        try {
          const configResponse = await readAllConfig({});

          // Check if the response has an error (hey-api style)
          if (configResponse.error) {
            const error = {
              response: configResponse.response,
              error: configResponse.error,
              message: 'Failed to read all config during initialization',
            };
            throw error;
          }

          setConfig(configResponse.data?.config || {});
        } catch (error: unknown) {
          // Check if this is an error from the hey-api client
          const errorObj = error as { response?: { status?: number }; status?: number };
          const isApiError = errorObj?.response?.status !== undefined;
          const status = isApiError ? errorObj.response?.status : errorObj?.status;

          // In Tauri mode, if we get a 404, try refreshing and retrying once
          if (configService.isTauriApp() && status === 404) {
            console.warn('Got 404 loading config, refreshing API client and retrying...');
            await refreshApiClient();

            // Get fresh config for retry
            const apiUrl = await configService.getApiUrl();
            const secretKey = await configService.getSecretKey();

            const configResponse = await readAllConfig({
              baseUrl: apiUrl,
              headers: {
                'Content-Type': 'application/json',
                'X-Secret-Key': secretKey,
              },
            });

            // Check if the response has an error (hey-api style)
            if (configResponse.error) {
              const error = {
                response: configResponse.response,
                error: configResponse.error,
                message: 'Failed to read all config during retry',
              };
              throw error;
            }

            setConfig(configResponse.data?.config || {});
          } else {
            throw error;
          }
        }

        // Load providers
        try {
          // Get fresh config
          const apiUrl = await configService.getApiUrl();
          const secretKey = await configService.getSecretKey();

          const providersResponse = await providers({
            baseUrl: apiUrl,
            headers: {
              'Content-Type': 'application/json',
              'X-Secret-Key': secretKey,
            },
          });
          setProvidersList(providersResponse.data || []);
        } catch (error) {
          console.error('Failed to load providers:', error);
        }

        // Load extensions
        try {
          // Get fresh config
          const apiUrl = await configService.getApiUrl();
          const secretKey = await configService.getSecretKey();

          const extensionsResponse = await apiGetExtensions({
            baseUrl: apiUrl,
            headers: {
              'Content-Type': 'application/json',
              'X-Secret-Key': secretKey,
            },
          });
          setExtensionsList(extensionsResponse.data?.extensions || []);
        } catch (error) {
          console.error('Failed to load extensions:', error);
        }
      } catch (error) {
        console.error('Failed to initialize configuration:', error);
        // Still set initialized to true so the app can render
        // The app will handle the error state
        setIsInitialized(true);
      }
    })();
  }, [refreshApiClient]);

  const contextValue = useMemo(() => {
    const disableAllExtensions = async () => {
      const currentExtensions = await getExtensions(true);
      for (const ext of currentExtensions) {
        if (ext.enabled) {
          await addExtension(ext.name, ext, false);
        }
      }
      await reloadConfig();
    };

    const enableBotExtensions = async (extensions: ExtensionConfig[]) => {
      for (const ext of extensions) {
        await addExtension(ext.name, ext, true);
      }
      await reloadConfig();
    };

    return {
      config,
      providersList,
      extensionsList,
      upsert,
      read,
      remove,
      addExtension,
      removeExtension,
      toggleExtension,
      getProviders,
      getExtensions,
      disableAllExtensions,
      enableBotExtensions,
      refreshApiClient,
    };
  }, [
    config,
    providersList,
    extensionsList,
    upsert,
    read,
    remove,
    addExtension,
    removeExtension,
    toggleExtension,
    getProviders,
    getExtensions,
    reloadConfig,
    refreshApiClient,
  ]);

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '16px',
          color: '#666',
        }}
      >
        Initializing Goose...
      </div>
    );
  }

  return <ConfigContext.Provider value={contextValue}>{children}</ConfigContext.Provider>;
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
