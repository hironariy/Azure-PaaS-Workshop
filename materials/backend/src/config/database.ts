/**
 * Database Configuration
 * Cosmos DB for MongoDB vCore connection with Mongoose
 * Reference: /design/DatabaseDesign.md
 *
 * PaaS Changes from IaaS:
 * - Added retryWrites: false (Cosmos DB requirement)
 * - Added tls: true (Cosmos DB requirement) - only for production
 * - Supports both COSMOS_CONNECTION_STRING and MONGODB_URI env vars
 * - Auto-detects local vs production environment for TLS settings
 */

import mongoose from 'mongoose';
import { config } from './environment';
import { logger, sanitizeConnectionString } from '../utils/logger';

/**
 * Detect if connecting to Cosmos DB (requires TLS) or local MongoDB (no TLS)
 */
function isCosmosDb(uri: string): boolean {
  return uri.includes('cosmos.azure.com') || uri.includes('mongodb+srv://');
}

/**
 * Connect to Cosmos DB for MongoDB vCore or local MongoDB
 * Handles connection events and retries
 */
export async function connectDatabase(): Promise<void> {
  try {
    // Sanitize connection string for logging (hide credentials)
    const sanitizedUri = sanitizeConnectionString(config.databaseUri);
    logger.info(`Connecting to database: ${sanitizedUri}`);

    const useCosmosDb = isCosmosDb(config.databaseUri);

    // Mongoose connection options
    const options: mongoose.ConnectOptions = {
      // Common options (same as IaaS)
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,

      // Connection management
      maxIdleTimeMS: 120000, // Close idle connections after 2 minutes
    };

    // Cosmos DB specific options (only for production)
    if (useCosmosDb) {
      options.retryWrites = false; // Cosmos DB doesn't support retry writes
      options.tls = true; // Cosmos DB requires TLS
      logger.info('Using Cosmos DB connection settings (TLS enabled, retryWrites disabled)');
    } else {
      logger.info('Using local MongoDB connection settings (TLS disabled)');
    }

    await mongoose.connect(config.databaseUri, options);

    logger.info(useCosmosDb 
      ? '✅ Connected to Cosmos DB for MongoDB vCore' 
      : '✅ Connected to local MongoDB');

    // Connection event handlers (same as IaaS)
    mongoose.connection.on('error', (err: Error) => {
      logger.error('Database connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Database disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Database reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Disconnect from database
 * Use during graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from database');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
}

/**
 * Check database connection health
 * Used by health check endpoint
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Get database connection state as string
 */
export function getDatabaseState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] ?? 'unknown';
}
