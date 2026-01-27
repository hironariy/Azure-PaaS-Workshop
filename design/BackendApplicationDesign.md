# Backend Application Design Specification (PaaS)

## Overview

This document defines the backend API requirements for the Azure PaaS Workshop blog application. The application runs on Azure App Service and connects to Cosmos DB for MongoDB vCore.

**Reference**: This specification maintains API compatibility with the [IaaS Workshop Backend](../iaas/design/BackendApplicationDesign.md) while adapting deployment patterns for PaaS.

## Application Overview

- **Type**: RESTful API server for multi-user blog application
- **Framework**: Express.js 4.18+ with TypeScript 5+
- **Database**: Azure Cosmos DB for MongoDB vCore (via Mongoose ODM)
- **Authentication**: Microsoft Entra ID OAuth2.0 JWT validation
- **Deployment**: Azure App Service (Linux, Node.js 20 LTS)
- **Target Users**: Workshop students learning Azure PaaS patterns
- **Code Standard**: Google TypeScript Style Guide (mandatory)

---

## Technology Stack (Same as IaaS)

### Core Technologies
- **Runtime**: Node.js 20.x LTS
- **Framework**: Express.js 4.18+
- **Language**: TypeScript 5+ (strict mode)
- **Database ODM**: Mongoose 8.x
- **Authentication**: jsonwebtoken, jwks-rsa (JWT validation)
- **Validation**: express-validator or Zod
- **Logging**: Winston or Pino (structured JSON logging)
- **Testing**: Jest + Supertest
- **Process Management**: Azure App Service (built-in)

### Security & Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: express-rate-limit
- **Compression**: compression middleware
- **Body Parsing**: express built-in JSON parser

---

## PaaS-Specific Changes (vs IaaS)

### Summary of Changes

| Aspect | IaaS Implementation | PaaS Implementation | Change Required |
|--------|--------------------|--------------------|-----------------|
| **Database Connection** | MongoDB RS connection string | Cosmos DB vCore connection string | ✅ Connection string format |
| **Environment Variables** | VM `/etc/environment` | App Service App Settings | ✅ Deployment method |
| **Process Management** | PM2/systemd | App Service built-in | ❌ Remove PM2 |
| **Health Checks** | Custom endpoint | Custom + App Service health | ✅ Configure path |
| **Logging** | Winston to files | Winston to stdout → App Insights | ✅ Log destination |
| **Secrets** | Key Vault + VM MI | Key Vault + App Service MI | ❌ Same pattern |
| **Port** | 3000 (configurable) | 8080 (App Service default) | ✅ PORT env var |

### Code Changes Required

#### 1. Database Connection Configuration

**File**: `src/config/database.ts`

```typescript
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// Support both IaaS and PaaS environment variable names
const MONGODB_URI = process.env.COSMOS_CONNECTION_STRING || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Database connection string not configured. Set COSMOS_CONNECTION_STRING or MONGODB_URI');
}

const connectOptions: mongoose.ConnectOptions = {
  // Connection pool settings
  maxPoolSize: 10,
  minPoolSize: 2,
  
  // Timeout settings
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  // Cosmos DB vCore specific settings
  retryWrites: false,  // Required: Cosmos DB doesn't support retry writes
  tls: true,           // Required: Cosmos DB requires TLS
  
  // Connection management
  maxIdleTimeMS: 120000,  // Close idle connections after 2 minutes
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI, connectOptions);
    logger.info('Connected to database', {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    });
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
};

// Graceful shutdown
export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('Database disconnected');
};
```

#### 2. Port Configuration

**File**: `src/config/environment.ts`

```typescript
export const config = {
  // App Service uses PORT=8080 by default
  port: parseInt(process.env.PORT || '8080', 10),
  
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUri: process.env.COSMOS_CONNECTION_STRING || process.env.MONGODB_URI,
  
  // Entra ID (same as IaaS)
  entraTenantId: process.env.ENTRA_TENANT_ID,
  entraClientId: process.env.ENTRA_CLIENT_ID,
  
  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};
```

#### 3. Logging Configuration (App Insights Integration)

**File**: `src/utils/logger.ts`

```typescript
import winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

// App Service captures stdout/stderr and sends to Log Analytics
// Use JSON format for structured logging
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  defaultMeta: {
    service: 'blogapp-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport - App Service captures this
    new winston.transports.Console(),
  ],
});

// Optional: Application Insights integration
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  // App Insights SDK auto-instruments when connection string is set
  // Winston logs are captured via console transport
  logger.info('Application Insights enabled');
}
```

#### 4. Health Check Endpoint

**File**: `src/routes/health.routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

// Basic health check - App Service health probe hits this
router.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };

  // Return 503 if database is not connected
  const statusCode = health.database === 'connected' ? 200 : 503;
  
  res.status(statusCode).json(health);
});

// Detailed health check (for debugging)
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    await mongoose.connection.db.admin().ping();
    
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'healthy', latency: 'ok' },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
```

#### 5. Graceful Shutdown

**File**: `src/server.ts`

```typescript
import { app } from './app';
import { config } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        nodeEnv: config.nodeEnv,
        port: config.port,
      });
    });

    // Graceful shutdown for App Service
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force exit after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
```

---

## API Endpoints (Same as IaaS)

The API endpoints are identical to the IaaS Workshop. See [IaaS Backend Design](../iaas/design/BackendApplicationDesign.md) for complete specification.

### Endpoint Summary

#### Health Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | App Service health probe |
| GET | `/health/ready` | None | Detailed readiness check |

#### User Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Required | Get current user profile |
| PUT | `/api/users/me` | Required | Update current user profile |
| GET | `/api/users/:username` | None | Get public user profile |

#### Post Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts` | Optional | List published posts |
| GET | `/api/posts/my` | Required | List current user's posts |
| GET | `/api/posts/:slug` | Optional | Get single post |
| POST | `/api/posts` | Required | Create new post |
| PUT | `/api/posts/:slug` | Required | Update post (author only) |
| DELETE | `/api/posts/:slug` | Required | Delete post (author only) |

#### Comment Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts/:slug/comments` | Optional | List comments |
| POST | `/api/posts/:slug/comments` | Required | Add comment |
| PUT | `/api/posts/:slug/comments/:id` | Required | Edit comment (author only) |
| DELETE | `/api/posts/:slug/comments/:id` | Required | Delete comment |

---

## Project Structure (Same as IaaS)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # Cosmos DB connection (modified)
│   │   ├── auth.ts              # Entra ID config
│   │   └── environment.ts       # Environment variables (modified)
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT validation
│   │   ├── error.middleware.ts  # Error handling
│   │   └── logger.middleware.ts # Request logging
│   ├── models/
│   │   ├── User.model.ts
│   │   ├── Post.model.ts
│   │   └── index.ts
│   ├── routes/
│   │   ├── health.routes.ts     # Health checks (modified)
│   │   ├── users.routes.ts
│   │   ├── posts.routes.ts
│   │   └── index.ts
│   ├── controllers/
│   │   ├── users.controller.ts
│   │   └── posts.controller.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   └── post.service.ts
│   ├── utils/
│   │   ├── logger.ts            # Winston config (modified)
│   │   └── errors.util.ts
│   ├── app.ts
│   └── server.ts                # Graceful shutdown (modified)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Deployment Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "lint": "eslint src --ext .ts",
    "test": "jest"
  }
}
```

### App Service Configuration

**App Settings** (via Bicep or Azure Portal):

| Setting | Value | Description |
|---------|-------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `8080` | App Service default (optional) |
| `COSMOS_CONNECTION_STRING` | `@Microsoft.KeyVault(...)` | Key Vault reference |
| `ENTRA_TENANT_ID` | `<tenant-id>` | Entra tenant |
| `ENTRA_CLIENT_ID` | `<client-id>` | Backend app registration |
| `CORS_ORIGINS` | `https://<swa-url>` | Static Web Apps URL |
| `LOG_LEVEL` | `info` | Logging level |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `<connection-string>` | App Insights (auto-set) |

### Startup Command

```
npm start
```

Or specify in App Service configuration:
```
node dist/server.js
```

---

## Security Configuration

### CORS Configuration

```typescript
// src/app.ts
import cors from 'cors';

const corsOptions: cors.CorsOptions = {
  origin: config.corsOrigins,  // ['https://<swa-url>.azurestaticapps.net']
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,  // 24 hours
};

app.use(cors(corsOptions));
```

### Helmet Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// Stricter limit for write operations
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 writes per minute
});

app.use('/api/posts', writeLimiter);
```

---

## Authentication (Same as IaaS)

### JWT Validation Middleware

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config/environment';

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.entraTenantId}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
});

const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    });
  }

  const token = authHeader.substring(7);

  jwt.verify(
    token,
    getKey,
    {
      audience: config.entraClientId,
      issuer: `https://login.microsoftonline.com/${config.entraTenantId}/v2.0`,
    },
    (err, decoded) => {
      if (err) {
        return res.status(401).json({
          error: { code: 'INVALID_TOKEN', message: 'Token validation failed' },
        });
      }
      req.user = decoded as Express.User;
      next();
    }
  );
};
```

---

## Error Handling

### Global Error Handler

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.message,
      },
    });
  }

  // Default error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
```

---

## Testing

### Test Configuration

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
```

### Integration Test Example

```typescript
// tests/integration/posts.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';

describe('Posts API', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('GET /api/posts', () => {
    it('should return published posts', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
    });
  });
});
```

---

## Deployment Workflow

### GitHub Actions for App Service

```yaml
# .github/workflows/backend-deploy.yml
name: Deploy Backend to App Service

on:
  push:
    branches: [main]
    paths:
      - 'materials/backend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: materials/backend/package-lock.json
      
      - name: Install dependencies
        working-directory: materials/backend
        run: npm ci
      
      - name: Build
        working-directory: materials/backend
        run: npm run build
      
      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: materials/backend
```

---

## Comparison: IaaS vs PaaS Backend Deployment

| Aspect | IaaS | PaaS |
|--------|------|------|
| **Deployment** | SCP files → PM2 restart | Git push → GitHub Actions |
| **Scaling** | Add VMs, configure LB | Auto-scale rules |
| **Monitoring** | Azure Monitor Agent | App Insights (built-in) |
| **Logs** | SSH → view files | Log stream in portal |
| **Updates** | SSH → pull → restart | Redeploy via CI/CD |
| **SSL** | App Gateway | App Gateway (same) |
| **Health Checks** | Custom script | App Service health probe |
| **Secrets** | Key Vault + VM MI | Key Vault + App MI |

---

## Appendix: Migration Checklist (IaaS → PaaS)

- [ ] Update connection string format for Cosmos DB vCore
- [ ] Add `retryWrites: false` and `tls: true` to Mongoose options
- [ ] Change PORT to 8080 (App Service default)
- [ ] Remove PM2 configuration (not needed)
- [ ] Update logging to stdout (App Service captures)
- [ ] Configure App Service App Settings
- [ ] Set up Key Vault reference for connection string
- [ ] Configure health check path in App Service
- [ ] Set up CORS for Static Web Apps URL
- [ ] Deploy via GitHub Actions
