// Utility to retry API calls with config refresh on 404 errors
import { configService } from '../services/configService';

interface RetryOptions {
  maxRetries?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: () => Promise<void>;
}

const defaultOptions: RetryOptions = {
  maxRetries: 1,
  shouldRetry: (error) => {
    // Retry on 404 errors in Tauri mode (likely stale port)
    const errorObj = error as { status?: number };
    return configService.isTauriApp() && errorObj?.status === 404;
  },
  onRetry: async () => {
    // Force config refresh by clearing cache
    configService.clearCache();
  },
};

export async function retryWithConfigRefresh<T>(
  apiCall: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= (opts.maxRetries || 0); attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      if (attempt < (opts.maxRetries || 0) && opts.shouldRetry && opts.shouldRetry(error)) {
        console.log(`API call failed with error, retrying (attempt ${attempt + 1})...`);

        if (opts.onRetry) {
          await opts.onRetry();
        }

        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}
