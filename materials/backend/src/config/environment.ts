/**
 * Environment Configuration
 * Loads and validates environment variables
 * Reference: /design/BackendApplicationDesign.md
 *
 * PaaS Changes from IaaS:
 * - Default port changed from 3000 to 8080 (App Service default)
 * - Added COSMOS_CONNECTION_STRING support alongside MONGODB_URI
 * - Rest of the configuration is identical to IaaS
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  databaseUri: string; // Renamed from mongodbUri for clarity
  entraTenantId: string;
  entraClientId: string;
  keyVaultName?: string;
  logLevel: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarOptional(key: string): string | undefined {
  return process.env[key];
}

function getEnvVarAsInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

/**
 * Get database connection string
 * Supports both PaaS (COSMOS_CONNECTION_STRING) and IaaS (MONGODB_URI) naming
 */
function getDatabaseUri(): string {
  // PaaS: Try COSMOS_CONNECTION_STRING first
  const cosmosUri = process.env.COSMOS_CONNECTION_STRING;
  if (cosmosUri) {
    return cosmosUri;
  }

  // IaaS: Fall back to MONGODB_URI
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    return mongoUri;
  }

  // Local development default
  return 'mongodb://localhost:27017/blogapp?directConnection=true';
}

export const config: EnvironmentConfig = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),

  // PaaS change: App Service uses port 8080 by default
  port: getEnvVarAsInt('PORT', 8080),

  // PaaS change: Support both connection string names
  databaseUri: getDatabaseUri(),

  entraTenantId: getEnvVar('ENTRA_TENANT_ID', 'your-tenant-id'),
  entraClientId: getEnvVar('ENTRA_CLIENT_ID', 'your-client-id'),
  keyVaultName: getEnvVarOptional('KEY_VAULT_NAME'),
  logLevel: getEnvVar('LOG_LEVEL', 'debug'),
  corsOrigins: getEnvVar('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(','),
  rateLimitWindowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 900000),
  rateLimitMaxRequests: getEnvVarAsInt('RATE_LIMIT_MAX_REQUESTS', 100),
};

export const isProduction = (): boolean => config.nodeEnv === 'production';
export const isDevelopment = (): boolean => config.nodeEnv === 'development';
