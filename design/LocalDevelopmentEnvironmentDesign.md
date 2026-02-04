# Local Development Environment Design

This document describes the local development environment architecture for the Azure PaaS Workshop.

## Overview

The local development environment uses Microsoft's SWA CLI and standard MongoDB with **real Microsoft Entra ID authentication**:

| Azure Service | Local Development Tool |
|---------------|------------------------|
| Azure Static Web Apps | **SWA CLI** (`@azure/static-web-apps-cli`) |
| Azure Cosmos DB vCore | **MongoDB** (Docker) |
| Azure App Service | Node.js + Express (direct run) |
| Microsoft Entra ID | **Real Microsoft Entra ID** (same as production) |

> **Note on Cosmos DB Emulator**: The Azure Cosmos DB Emulator (MongoDB API) only supports x64 architecture.
> For Apple Silicon (M1/M2/M3) and Windows ARM, we use standard MongoDB.
> Mongoose ODM works identically with both MongoDB and Cosmos DB for MongoDB vCore.
> Reference: https://learn.microsoft.com/en-us/azure/cosmos-db/emulator-linux

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Local Development Environment                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────┐      ┌─────────────────────────┐      ┌────────────────┐   │
│   │   Browser   │──────│  SWA CLI Emulator       │──────│ Backend (API)  │   │
│   │             │      │  localhost:4280         │      │ Express :8080  │   │
│   └─────────────┘      │  - Static content       │      └────────────────┘   │
│         │              │  - Auth emulator        │              │             │
│         │              │  - API proxy            │              │             │
│         │              └─────────────────────────┘              │             │
│         │                      │                                │             │
│         │                      │                                │             │
│         ▼                      ▼                                ▼             │
│   ┌─────────────────────┐    ┌───────────────┐    ┌────────────────────────┐ │
│   │  Microsoft Entra ID │    │ Vite Dev      │    │ MongoDB (Docker)       │ │
│   │  (Real Auth)        │    │ Server :5173  │    │ :27017 (MongoDB)       │ │
│   │                     │    │ (Optional)    │    │ :8081  (Mongo Express) │ │
│   └─────────────────────┘    └───────────────┘    └────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Development Tools

### 1. Azure Static Web Apps CLI (SWA CLI)

**Purpose**: Emulates Azure Static Web Apps locally, including:
- Static file serving
- API routing to backend
- **Authentication emulator** (provides fake identity without real Entra ID)
- SPA routing (fallback to index.html)

**Installation**:
```bash
npm install -g @azure/static-web-apps-cli
```

**Key Features**:
- Serves frontend from `dist/` folder (after build)
- Proxies `/api/*` requests to backend
- Routes authentication to real Microsoft Entra ID via MSAL
- Matches production SWA behavior exactly

**Reference**: [Azure Static Web Apps CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/static-web-apps-cli-overview)

### 2. MongoDB (Docker)

**Purpose**: Local MongoDB database compatible with Cosmos DB for MongoDB vCore

The Mongoose ODM works identically with both:
- **Local**: MongoDB 7.0 (Docker)
- **Production**: Azure Cosmos DB for MongoDB vCore

**Docker Compose**:
```yaml
services:
  mongodb:
    image: mongo:7.0
    container_name: paas-blogapp-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  mongo-express:
    image: mongo-express:1.0
    container_name: paas-blogapp-mongo-express
    ports:
      - "8081:8081"
    environment:
      - ME_CONFIG_MONGODB_SERVER=mongodb
      - ME_CONFIG_BASICAUTH_USERNAME=admin
      - ME_CONFIG_BASICAUTH_PASSWORD=admin
```

**Connection String**:
```
mongodb://localhost:27017/blogapp
```

**Web UI**: http://localhost:8081 (Mongo Express)

### 3. Backend (Express API)

The backend runs directly with Node.js - no special emulator needed since App Service is essentially Node.js hosting.

| Aspect | Local Development | PaaS Production |
|--------|-------------------|-----------------|
| Runtime | Node.js local | Azure App Service |
| Port | 8080 | 8080 (WEBSITES_PORT) |
| Database | MongoDB (Docker) | Cosmos DB vCore |
| Config Source | `.env` | App Service Configuration |

### 4. Authentication (Real Microsoft Entra ID)

This workshop uses **real Microsoft Entra ID authentication** for both local development and production.

**Why Real Entra ID Locally?**
- Identical authentication flow in dev and production
- Validates token validation logic end-to-end
- No surprises when deploying to Azure
- Workshop participants learn real OAuth2/OIDC flows

**Prerequisites**:
- Microsoft Entra ID Tenant (can use existing Azure subscription's tenant)
- Two App Registrations:
  - **Frontend SPA**: For browser-based MSAL authentication
  - **Backend API**: For JWT token validation
- Add redirect URIs in Frontend SPA registration:
  - `http://localhost:5173` (Vite direct)
  - `http://localhost:4280` (SWA CLI emulator)

**Setup Instructions**: See [Entra ID Setup Guide](../docs/entra-id-setup.md)

## Port Assignments

| Service | Port | Notes |
|---------|------|-------|
| SWA CLI (main entry) | 4280 | **Primary access point for browser** |
| Frontend (Vite dev) | 5173 | Vite dev server (SWA CLI proxies here) |
| Backend (Express) | 8080 | App Service default |
| MongoDB | 27017 | Database |
| Mongo Express | 8081 | Database web UI |

**PaaS vs IaaS Port Difference:**
- IaaS: Backend runs on port **3000** (common Express default)
- PaaS: Backend runs on port **8080** (Azure App Service default)

## Configuration Strategy

### Environment Variables

```
┌──────────────────────────────────────────────────────────────────┐
│                    Configuration Flow                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Development                          Production                  │
│  ───────────                          ──────────                  │
│                                                                   │
│  Frontend:                            Frontend:                   │
│  .env.local → Vite → Browser          SWA Config → /config.json   │
│                                                                   │
│  Backend:                             Backend:                    │
│  .env → process.env                   App Service → process.env   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Backend Environment Variables

```env
# Server
NODE_ENV=development
PORT=8080

# Database (MongoDB)
MONGODB_URI=mongodb://localhost:27017/blogapp

# Microsoft Entra ID (REQUIRED - get from Azure Portal)
# Tenant ID: Azure Portal > Microsoft Entra ID > Overview
# Client ID: Azure Portal > App registrations > Backend API > Application (client) ID
ENTRA_TENANT_ID=<your-tenant-id>
ENTRA_CLIENT_ID=<your-backend-api-client-id>

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

### Frontend Environment Variables

```env
# Microsoft Entra ID - Frontend SPA App (REQUIRED)
# Get from Azure Portal > App registrations > Frontend SPA
VITE_ENTRA_CLIENT_ID=<your-frontend-spa-client-id>
VITE_ENTRA_TENANT_ID=<your-tenant-id>
VITE_ENTRA_REDIRECT_URI=http://localhost:5173

# Backend API App (for token audience)
VITE_API_CLIENT_ID=<your-backend-api-client-id>
```

## SWA CLI Configuration

Create `swa-cli.config.json` in the project root:

```json
{
  "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  "configurations": {
    "paas-workshop": {
      "appLocation": "materials/frontend",
      "outputLocation": "dist",
      "apiLocation": "",
      "appDevserverUrl": "http://localhost:5173",
      "apiDevserverUrl": "http://localhost:8080"
    }
  }
}
```

## Development Workflow

### Typical Session (Using SWA CLI)

```bash
# 1. Start MongoDB
cd dev-environment && docker-compose up -d

# 2. Verify MongoDB is running
docker-compose ps

# 3. Start Backend (Terminal 1)
cd materials/backend && npm run dev

# 4. Start Frontend dev server (Terminal 2)
cd materials/frontend && npm run dev

# 5. Start SWA CLI (Terminal 3) - Main entry point
swa start http://localhost:5173 --api-devserver-url http://localhost:8080

# 6. Open browser: http://localhost:4280 (NOT 5173!)
```

### Authentication Flow (Real Microsoft Entra ID)

1. Browser loads app at `http://localhost:5173`
2. User clicks "Sign In"
3. MSAL redirects to Microsoft login page
4. User authenticates with Microsoft account
5. Microsoft redirects back with authorization code
6. MSAL exchanges code for tokens
7. Frontend includes access token in API requests
8. Backend validates JWT token against Entra ID

**Entra ID Configuration Required Before Starting!**

See [Entra ID Setup Guide](../docs/entra-id-setup.md) for:
- Creating Frontend SPA app registration
- Creating Backend API app registration  
- Configuring redirect URIs
- Setting up API permissions

## Differences from IaaS Local Development

| Aspect | IaaS | PaaS |
|--------|------|------|
| Backend Port | 3000 | 8080 |
| Database | Docker MongoDB (Replica Set) | Docker MongoDB (Single Node) |
| Production DB | MongoDB on VMs | Cosmos DB for MongoDB vCore |
| Frontend Entry Point | Vite direct (:5173) | Vite direct (:5173) |
| Auth Testing | Real Entra ID | Real Entra ID |
| Init Script | init-replica-set.js | None needed |

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x LTS | Backend/Frontend runtime |
| Docker Desktop | Latest | MongoDB container |
| npm | 10.x+ | Package management |
| SWA CLI | 2.x+ | Static Web Apps emulator |

**Install SWA CLI**:
```bash
npm install -g @azure/static-web-apps-cli
```

### Azure Resources (Required)

The following Azure resources are required for local development:

| Resource | Purpose |
| Microsoft Entra ID Tenant | Authentication |
| Frontend App Registration | SPA authentication |
| Backend App Registration | API token validation |

## Network Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  localhost                                                                   │
│                                                                              │
│    Browser → :4280 (SWA CLI)                                                 │
│                   │                                                          │
│         ┌─────────┴─────────┐                                                │
│         │                   │                                                │
│         ▼                   ▼                                                │
│    Static Content      /api/* proxy                                          │
│    (from :5173 or dist/)    │                                                │
│                             ▼                                                │
│                      :8080 (Backend)                                         │
│                             │                                                │
│                             │ mongoose.connect()                             │
│                             ▼                                                │
│                      :27017 (MongoDB)                                        │
│                                                                              │
│    Auth: MSAL → Real Microsoft Entra ID                                      │
│           (login.microsoftonline.com)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Considerations for Local Development

1. **MongoDB**: Standard MongoDB with no authentication (dev only)
   - No password required for local development
   - Production uses Cosmos DB with proper authentication

2. **Authentication**:
   - Real Microsoft Entra ID for both local and production
   - Requires app registrations in Azure Portal
   - Tokens validated by backend JWT middleware

3. **Tokens in sessionStorage**: MSAL stores tokens in sessionStorage
   - Cleared on tab close
   - Safer than localStorage for dev

4. **CORS Configured**: Backend allows localhost origins
   - Restricted to specific ports
   - Production uses different origins

## Related Documents

- [Azure Architecture Design](AzureArchitectureDesign.md)
- [Backend Application Design](BackendApplicationDesign.md)
- [Frontend Application Design](FrontendApplicationDesign.md)
- [Local Development Setup Guide](../docs/local-development-setup.md)
