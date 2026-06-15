/**
 * Application Configuration
 * Runtime configuration that supports both local development and Azure production
 *
 * Reference: /design/FrontendApplicationDesign.md - Workshop Configuration: Runtime Config Pattern
 *
 * PaaS vs IaaS:
 * - This file is IDENTICAL to IaaS version
 * - Pattern: Development uses Vite env vars, production uses inline window.__APP_CONFIG__
 * - IaaS: config injected by Bicep CustomScript into index.html on NGINX VM
 * - PaaS: config injected at deploy time into index.html (not a separate file for security)
 */

// Extend Window interface for runtime config
declare global {
  interface Window {
    __APP_CONFIG__?: {
      ENTRA_TENANT_ID?: string;
      ENTRA_FRONTEND_CLIENT_ID?: string;
      ENTRA_BACKEND_CLIENT_ID?: string;
      API_BASE_URL?: string;
    } | null;
  }
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  entraTenantId: string;
  entraFrontendClientId: string;
  entraBackendClientId: string;
  apiBaseUrl: string;
  redirectUri: string;
}

/**
 * Cached configuration - loaded once at app startup
 */
let cachedConfig: AppConfig | null = null;

const requiredConfigFields: Array<[keyof AppConfig, string]> = [
  ['entraTenantId', 'ENTRA_TENANT_ID'],
  ['entraFrontendClientId', 'ENTRA_FRONTEND_CLIENT_ID'],
  ['entraBackendClientId', 'ENTRA_BACKEND_CLIENT_ID'],
];

function isMissingConfigValue(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length === 0 ||
    normalized === 'null' ||
    normalized === 'undefined' ||
    /^your-.*-here$/i.test(normalized) ||
    /^<.*>$/.test(normalized)
  );
}

function assertRequiredConfig(config: AppConfig, source: string): void {
  const missing = requiredConfigFields
    .filter(([field]) => isMissingConfigValue(config[field]))
    .map(([, envName]) => envName);

  if (missing.length > 0) {
    throw new Error(
      `[Config] Missing required runtime configuration from ${source}: ${missing.join(', ')}. ` +
        'Recreate deploy-frontend.local.env and rerun scripts/deploy-frontend.sh.',
    );
  }
}

function buildConfigFromEnv(): AppConfig {
  return {
    entraTenantId: (import.meta.env.VITE_ENTRA_TENANT_ID || '').trim(),
    entraFrontendClientId: (import.meta.env.VITE_ENTRA_CLIENT_ID || '').trim(),
    entraBackendClientId: (import.meta.env.VITE_API_CLIENT_ID || '').trim(),
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').trim(),
    redirectUri: (import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin).trim(),
  };
}

/**
 * Load configuration from appropriate source based on environment
 *
 * Must be called before MSAL initialization (in main.tsx before React renders)
 */
export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Development: use Vite environment variables
  if (import.meta.env.DEV) {
    console.log('[Config] Loading from Vite environment variables (development)');
    cachedConfig = buildConfigFromEnv();

    // Validate required values
    if (!cachedConfig.entraTenantId || !cachedConfig.entraFrontendClientId) {
      console.warn(
        '[Config] Missing required Entra ID configuration in .env file.\n' +
          'Copy .env.example to .env.local and fill in your values.',
      );
    }

    return cachedConfig;
  }

  // Production: read from window.__APP_CONFIG__ (injected at deploy time)
  // This is more secure than serving a separate /config.json file
  console.log('[Config] Loading from window.__APP_CONFIG__ (production)');
  
  const inlineConfig = window.__APP_CONFIG__;
  if (inlineConfig && inlineConfig.ENTRA_TENANT_ID) {
    cachedConfig = {
      entraTenantId: (inlineConfig.ENTRA_TENANT_ID || '').trim(),
      entraFrontendClientId: (inlineConfig.ENTRA_FRONTEND_CLIENT_ID || '').trim(),
      entraBackendClientId: (inlineConfig.ENTRA_BACKEND_CLIENT_ID || '').trim(),
      apiBaseUrl: (inlineConfig.API_BASE_URL || '/api').trim(),
      redirectUri: window.location.origin,
    };
    assertRequiredConfig(cachedConfig, 'window.__APP_CONFIG__');
    console.log('[Config] Configuration loaded successfully from inline config');
    return cachedConfig;
  }

  // Fallback: try /config.json for backwards compatibility (IaaS pattern)
  console.log('[Config] No inline config found, trying /config.json fallback');
  try {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();

        cachedConfig = {
          entraTenantId: (json.ENTRA_TENANT_ID || '').trim(),
          entraFrontendClientId: (json.ENTRA_FRONTEND_CLIENT_ID || '').trim(),
          entraBackendClientId: (json.ENTRA_BACKEND_CLIENT_ID || '').trim(),
          apiBaseUrl: (json.API_BASE_URL || '/api').trim(),
          redirectUri: window.location.origin,
        };

        assertRequiredConfig(cachedConfig, '/config.json');
        console.log('[Config] Configuration loaded successfully from /config.json');
        return cachedConfig;
      }

      console.warn(
        `[Config] /config.json returned unexpected content-type (${contentType}). Falling back to build-time env.`,
      );
    } else {
      console.warn(
        `[Config] /config.json not available (${response.status} ${response.statusText}). Falling back to build-time env.`,
      );
    }
  } catch (error) {
    console.warn('[Config] Failed to load /config.json. Falling back to build-time env.', error);
  }

  cachedConfig = buildConfigFromEnv();
  cachedConfig.redirectUri = window.location.origin;

  assertRequiredConfig(cachedConfig, 'build-time VITE_* values');

  return cachedConfig;
}

/**
 * Get the current configuration
 * Throws if loadConfig() hasn't been called yet
 */
export function getConfig(): AppConfig {
  if (!cachedConfig) {
    throw new Error(
      'Configuration not loaded. Call loadConfig() in main.tsx before using getConfig().',
    );
  }
  return cachedConfig;
}

/**
 * Check if configuration is loaded
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}
