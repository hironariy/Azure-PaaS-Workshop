/**
 * Shared MSAL Instance
 * Singleton PublicClientApplication for Microsoft Entra ID authentication
 * Reference: /design/FrontendApplicationDesign.md
 *
 * IMPORTANT: This module now supports runtime configuration.
 * Call initializeMsal() after loadConfig() in main.tsx
 *
 * PaaS vs IaaS:
 * - This file is IDENTICAL to IaaS version
 * - MSAL initialization pattern is the same for both environments
 */

import { PublicClientApplication, EventType, type Configuration } from '@azure/msal-browser';
import { createMsalConfig } from './authConfig';
import { isConfigLoaded } from './appConfig';

/**
 * Singleton MSAL instance.
 * Created only after runtime config has been loaded.
 */
let msalInstance: PublicClientApplication | null = null;

/**
 * Flag to track if MSAL has been properly initialized with runtime config
 */
let msalInitialized = false;

/**
 * Promise that resolves when MSAL is fully initialized
 * This MUST be awaited before making any authenticated API calls
 */
let msalInitPromise: Promise<void> = Promise.resolve();

function registerMsalEventCallbacks(instance: PublicClientApplication): void {
  instance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account: unknown };
      if (payload.account) {
        instance.setActiveAccount(
          payload.account as Parameters<typeof instance.setActiveAccount>[0],
        );
      }
    }
    if (event.eventType === EventType.LOGOUT_SUCCESS) {
      instance.setActiveAccount(null);
    }
  });
}

/**
 * Initialize MSAL with runtime configuration
 * This MUST be called after loadConfig() in main.tsx
 *
 * @returns Promise that resolves when MSAL is ready
 */
export async function initializeMsal(): Promise<void> {
  if (msalInitialized) {
    console.log('[MSAL] Already initialized');
    return msalInitPromise;
  }

  // Ensure app config is loaded first
  if (!isConfigLoaded()) {
    throw new Error(
      '[MSAL] App configuration not loaded. Call loadConfig() before initializeMsal().',
    );
  }

  console.log('[MSAL] Initializing with runtime configuration...');

  // Create new MSAL instance with runtime config
  const config: Configuration = createMsalConfig();
  const runtimeMsalInstance = new PublicClientApplication(config);

  // Set up event callbacks BEFORE handling redirect
  registerMsalEventCallbacks(runtimeMsalInstance);

  msalInstance = runtimeMsalInstance;
  msalInitPromise = (async () => {
    // Initialize MSAL
    await runtimeMsalInstance.initialize();

    // Handle redirect response (CRITICAL: must complete before React renders)
    try {
      const response = await runtimeMsalInstance.handleRedirectPromise();
      if (response) {
        console.log('[MSAL] Redirect response received, setting active account');
        runtimeMsalInstance.setActiveAccount(response.account);
      } else {
        // No redirect response - check for existing accounts
        const accounts = runtimeMsalInstance.getAllAccounts();
        if (accounts.length > 0 && accounts[0] !== undefined) {
          console.log('[MSAL] Found existing account, setting as active');
          runtimeMsalInstance.setActiveAccount(accounts[0]);
        }
      }
    } catch (error) {
      console.error('[MSAL] Redirect handling error:', error);
    }

    msalInitialized = true;
    console.log('[MSAL] Initialization complete');
  })();

  await msalInitPromise;
}

/**
 * Get the MSAL instance
 * Throws if initializeMsal() hasn't been called
 */
export function getMsalInstance(): PublicClientApplication {
  if (!msalInitialized || !msalInstance) {
    throw new Error(
      '[MSAL] Instance accessed before initialization. Call initializeMsal() in main.tsx.',
    );
  }
  return msalInstance;
}

/**
 * Get the initialization promise
 * Use this to await MSAL readiness
 */
export function getMsalInitPromise(): Promise<void> {
  return msalInitPromise;
}

/**
 * Helper to check if MSAL is initialized
 * Useful for debugging
 */
export function isMsalInitialized(): boolean {
  return msalInitialized;
}
