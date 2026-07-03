# Blog Application Backend (Azure PaaS)

Express.js API server for the multi-user blog application, deployed on Azure App Service with Cosmos DB for MongoDB vCore.

## 🎯 Learning Objective

This backend demonstrates that **migrating from IaaS to PaaS requires minimal code changes**. The same Express.js application runs on both Azure VMs (IaaS) and Azure App Service (PaaS) with only configuration differences.

## 📊 IaaS vs PaaS Comparison

### What Changes

| Aspect | IaaS | PaaS | Code Impact |
|--------|------|------|-------------|
| **Default Port** | 3000 | 8080 | Config only |
| **Database Connection** | `mongodb://` with replica set | `mongodb+srv://` with TLS | Config only |
| **Connection Options** | Standard MongoDB | `retryWrites: false`, `tls: true` | +2 lines |
| **Process Manager** | PM2 | Built-in (App Service) | Remove PM2 |
| **Logging Destination** | Files | stdout → App Insights | No change* |
| **Environment Variables** | VM `/etc/environment` | App Service App Settings | Config only |

*Winston writes to console in both cases; App Service captures stdout automatically.

### What Stays the Same

- ✅ All Express.js routes and controllers
- ✅ All Mongoose models and schemas
- ✅ Authentication middleware (Microsoft Entra ID)
- ✅ Validation and sanitization logic
- ✅ Error handling patterns
- ✅ Business logic

### Code Diff Summary

Only 3 files have PaaS-specific changes:

1. **`src/config/database.ts`** - Added Cosmos DB connection options
2. **`src/config/environment.ts`** - Changed default port to 8080
3. **`scripts/init-cosmosdb.js`** - New file (replaces `init-replica-set.js`)

## 🏗️ Project Structure

```
backend/
├── scripts/
│   ├── init-cosmosdb.js     # Database initialization (PaaS)
│   └── seed.ts              # Sample data seeding
├── src/
│   ├── config/
│   │   ├── database.ts      # Cosmos DB connection (modified)
│   │   └── environment.ts   # Environment variables (modified)
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Post.ts
│   │   ├── Comment.ts
│   │   └── index.ts
│   ├── routes/
│   │   ├── health.routes.ts
│   │   ├── users.routes.ts
│   │   ├── posts.routes.ts
│   │   ├── comments.routes.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── sanitize.ts
│   └── app.ts               # Express application
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 24.x LTS
- npm or yarn
- Docker (for local MongoDB) or Azure Cosmos DB connection

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start local MongoDB** (using Docker)
   ```bash
   cd ../..  # Go to repository root
   docker-compose -f dev-environment/docker-compose.yml up -d
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Initialize database indexes**
   ```bash
   # For local MongoDB (optional - Mongoose creates indexes automatically)
   mongosh mongodb://localhost:27017/blogapp scripts/init-cosmosdb.js
   ```

5. **Seed sample data**
   ```bash
   npm run seed
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Test the API**
   ```bash
   curl http://localhost:8080/health
   curl http://localhost:8080/api/posts
   ```

### Testing with Cosmos DB

To test against Azure Cosmos DB for MongoDB vCore:

1. Create a Cosmos DB for MongoDB vCore cluster in Azure Portal
2. Get the connection string from Azure Portal
3. Update `.env`:
   ```
   COSMOS_CONNECTION_STRING=mongodb+srv://...
   ```
4. Run the initialization script:
   ```bash
   mongosh "<your-cosmos-connection-string>" scripts/init-cosmosdb.js
   ```

## 📡 API Endpoints

### Health Checks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | App Service health probe |
| GET | `/health/detailed` | Detailed health status |
| GET | `/ready` | Readiness check |
| GET | `/live` | Liveness check |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Required | Get current user profile |
| PUT | `/api/users/me` | Required | Update current user profile |
| GET | `/api/users/:username` | None | Get public user profile |

### Posts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts` | Optional | List published posts |
| GET | `/api/posts/my` | Required | List current user's posts |
| GET | `/api/posts/:slug` | Optional | Get single post |
| POST | `/api/posts` | Required | Create new post |
| PUT | `/api/posts/:slug` | Required | Update post (author only) |
| DELETE | `/api/posts/:slug` | Required | Delete post (author only) |

### Comments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts/:slug/comments` | Optional | List comments |
| POST | `/api/posts/:slug/comments` | Required | Add comment |
| PUT | `/api/comments/:id` | Required | Edit comment (author only) |
| DELETE | `/api/comments/:id` | Required | Delete comment (author only) |

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `8080` | Server port (8080 for App Service) |
| `COSMOS_CONNECTION_STRING` | Yes* | - | Cosmos DB connection string |
| `MONGODB_URI` | Yes* | - | MongoDB connection string (fallback) |
| `ENTRA_TENANT_ID` | Yes | - | Microsoft Entra tenant ID |
| `ENTRA_CLIENT_ID` | Yes | - | Backend app registration client ID |
| `CORS_ORIGINS` | No | `localhost` | Comma-separated allowed origins |
| `LOG_LEVEL` | No | `debug` | Logging level |

*Either `COSMOS_CONNECTION_STRING` or `MONGODB_URI` is required.

### App Service Configuration

In Azure App Service, configure these as **App Settings**:

```bicep
appSettings: [
  { name: 'NODE_ENV', value: 'production' }
  { name: 'COSMOS_CONNECTION_STRING', value: '@Microsoft.KeyVault(VaultName=...;SecretName=cosmos-connection-string)' }
  { name: 'ENTRA_TENANT_ID', value: '<tenant-id>' }
  { name: 'ENTRA_CLIENT_ID', value: '<client-id>' }
  { name: 'CORS_ORIGINS', value: 'https://<your-swa>.azurestaticapps.net' }
]
```

## 🔐 Authentication

The API uses Microsoft Entra ID for authentication:

1. Frontend obtains access token from Entra ID
2. Frontend includes token in `Authorization: Bearer <token>` header
3. Backend validates token against Entra ID JWKS endpoint
4. User identity is extracted from token claims

See [/design/BackendApplicationDesign.md](../../design/BackendApplicationDesign.md) for details.

## 🧪 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run seed` | Populate database with sample data |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run type-check` | TypeScript type checking |

## 📚 Reference

- [Backend Design Specification](../../design/BackendApplicationDesign.md)
- [Database Design Specification](../../design/DatabaseDesign.md)
- [IaaS Backend](../../iaas/materials/backend/) - Compare with IaaS implementation

## 🔄 Migration Notes

When migrating the IaaS backend to PaaS:

1. **Update connection string environment variable name**
   - IaaS: `MONGODB_URI`
   - PaaS: `COSMOS_CONNECTION_STRING` (or keep `MONGODB_URI`)

2. **Add Cosmos DB connection options**
   ```typescript
   const options = {
     retryWrites: false,  // Cosmos DB requirement
     tls: true,           // Cosmos DB requirement
   };
   ```

3. **Change default port** (optional - App Service sets `PORT` automatically)
   - IaaS: 3000
   - PaaS: 8080

4. **Remove PM2 configuration** (App Service manages the process)

5. **Run initialization script**
   - IaaS: `init-replica-set.js` (creates replica set)
   - PaaS: `init-cosmosdb.js` (creates indexes only)

That's it! The application code is otherwise identical.
