import { configService } from './services/configService';

// Cache for API URL and secret key to enable synchronous access
let cachedApiUrl: string | null = null;
let cachedSecretKey: string | null = null;

// Helper to construct API endpoints
export const getApiUrl = async (endpoint: string): Promise<string> => {
  const baseUrl = await configService.getApiUrl();
  // Cache the base URL for sync access
  cachedApiUrl = baseUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Synchronous version that uses cached value or defaults
export const getApiUrlSync = (endpoint: string): string => {
  // Use cached value if available, otherwise use default
  const baseUrl = cachedApiUrl || 'http://127.0.0.1:3000';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

export const getSecretKey = async (): Promise<string> => {
  const key = await configService.getSecretKey();
  // Cache for sync access
  cachedSecretKey = key;
  return key;
};

// Synchronous version that uses cached value or defaults
export const getSecretKeySync = (): string => {
  return cachedSecretKey || '';
};

// Initialize the cache on module load
(async () => {
  try {
    const [apiUrl, secretKey] = await Promise.all([
      configService.getApiUrl(),
      configService.getSecretKey(),
    ]);
    cachedApiUrl = apiUrl;
    cachedSecretKey = secretKey;
    console.log('Config cache initialized:', { apiUrl, secretKey: secretKey ? 'SET' : 'NOT SET' });
  } catch (error) {
    console.warn('Failed to initialize config cache:', error);
  }
})();
