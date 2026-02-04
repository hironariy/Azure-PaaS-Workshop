# Local Development Setup Guide

Complete guide to run the Azure PaaS Workshop Blog Application locally.

## Prerequisites

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20.x LTS | [nodejs.org](https://nodejs.org/) |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| npm | 10.x+ | Included with Node.js |
| Git | Latest | [git-scm.com](https://git-scm.com/) |
| SWA CLI | Latest | `npm install -g @azure/static-web-apps-cli` |

**Verify installations:**
```bash
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x
docker --version  # Should show Docker version 24.x or later
swa --version     # Should show SWA CLI version
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Local Development                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Browser ──► SWA CLI (:4280) ──┬──► Frontend (Vite :5173)              │
│                                 │                                        │
│                                 └──► Backend (Express :8080)             │
│                                             │                            │
│              Auth Emulator ◄────────────────┤                            │
│              (Fake Identity)                │                            │
│                                             ▼                            │
│                               MongoDB (Docker :27017)                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Development Tools

| Tool | Purpose | Benefit |
|------|---------|---------|
| **SWA CLI** | Emulates Azure Static Web Apps | Test routing, API proxying, auth locally |
| **SWA Auth Emulator** | Fake authentication | No Azure Entra ID setup needed for dev |
| **MongoDB** | Local database | Compatible with Cosmos DB for MongoDB vCore |

> **Note on Cosmos DB Emulator**: The Azure Cosmos DB Emulator (MongoDB API) only supports x64 architecture. 
> For Apple Silicon (M1/M2/M3) and Windows ARM, we use standard MongoDB.
> Mongoose ODM works identically with both MongoDB and Cosmos DB for MongoDB vCore.

---

## Step 1: Install SWA CLI (Global)

```bash
npm install -g @azure/static-web-apps-cli

# Verify installation
swa --version
```

---

## Step 2: Start MongoDB (Docker)

```bash
# Navigate to dev-environment folder
cd dev-environment

# Start MongoDB container
docker-compose up -d

# Verify it's running
docker-compose ps
```

**Expected output:**
```
NAME                         STATUS          PORTS
paas-blogapp-mongo           running         0.0.0.0:27017->27017/tcp
paas-blogapp-mongo-express   running         0.0.0.0:8081->8081/tcp
```

### Access Mongo Express (Optional)

Open http://localhost:8081 in your browser to view database via web UI.
- Username: `admin`
- Password: `admin`

---

## Step 3: Configure Backend

### 3.1 Create Environment File

```bash
cd materials/backend

# Copy example config
cp .env.example .env
```

### 3.2 Edit `.env` for MongoDB

```bash
# materials/backend/.env

NODE_ENV=development
PORT=8080

# Local MongoDB (Docker)
MONGODB_URI=mongodb://localhost:27017/blogapp

# When using SWA Auth Emulator - these are not used
# The auth emulator provides fake identity via x-ms-client-principal header
ENTRA_TENANT_ID=not-used-with-auth-emulator
ENTRA_CLIENT_ID=not-used-with-auth-emulator

# Logging
LOG_LEVEL=debug

# CORS (SWA CLI handles routing, but keep for direct API access)
CORS_ORIGINS=http://localhost:4280,http://localhost:5173,http://localhost:8080
```

### 3.3 Install Dependencies and Start

```bash
# Install packages
npm install

# Start development server (with hot reload)
npm run dev
```

**Expected output:**
```
[INFO] Server running on port 8080
[INFO] MongoDB connected successfully
[INFO] Environment: development
```

### 3.4 Verify Backend Health

```bash
curl http://localhost:8080/health
```

**Expected response:**
```json
{"status":"healthy","timestamp":"...","environment":"development"}
```

---

## Step 4: Configure Frontend

### 4.1 Create Environment File

```bash
cd materials/frontend

# Copy example config
cp .env.example .env.local
```

### 4.2 Edit `.env.local` for SWA CLI Mode

```bash
# materials/frontend/.env.local

# When using SWA Auth Emulator - these can be placeholder values
# Real authentication is handled by SWA CLI's auth emulator
VITE_ENTRA_CLIENT_ID=placeholder-for-dev
VITE_ENTRA_TENANT_ID=placeholder-for-dev
VITE_ENTRA_REDIRECT_URI=http://localhost:4280

# API is proxied through SWA CLI
VITE_API_CLIENT_ID=placeholder-for-dev
```

### 4.3 Install Dependencies and Start

```bash
# Install packages
npm install

# Start development server
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 5: Start SWA CLI (Main Entry Point)

Open a **new terminal** and run:

```bash
cd materials/frontend

# Start SWA CLI with frontend and backend
swa start http://localhost:5173 --api-location http://localhost:8080
```

**Expected output:**
```
Azure Static Web Apps emulator started.

   Serving static content from: http://localhost:5173
   API available at: http://localhost:8080

   Visit http://localhost:4280 to open the app
```

**⚠️ IMPORTANT**: Always access the app via **http://localhost:4280** (SWA CLI), NOT :5173 or :8080 directly.

---

## Step 6: Test the Application

### 6.1 Open Browser

Navigate to: **http://localhost:4280**

### 6.2 Test Public Features (No Login Required)

- ✅ View home page (will show "No posts yet" initially)
- ✅ Application loads without errors

### 6.3 Test Authentication with Auth Emulator

SWA CLI provides a **fake authentication** feature:

1. Go to: http://localhost:4280/.auth/login/aad
2. You'll see a mock login page
3. Enter fake user details:
   - **User ID**: `test-user-001`
   - **Username**: `testuser@example.com`
   - **Claims**: Add `name` = `Test User`
4. Click **Login**
5. You'll be redirected back to the app as an authenticated user

### 6.4 Test Authenticated Features

After fake login:
- ✅ Click **"Write Post"** → Create a new post
- ✅ Click **"My Posts"** → View your posts (including drafts)
- ✅ Edit your posts
- ✅ Delete your posts

### 6.5 Logout

Go to: http://localhost:4280/.auth/logout

---

## Quick Reference Commands

### Start Everything (3 Terminals)

```bash
# Terminal 1: Cosmos DB Emulator
cd dev-environment && docker-compose up -d

# Terminal 2: Backend
cd materials/backend && npm run dev

# Terminal 3: Frontend + SWA CLI
cd materials/frontend && npm run dev
# In another terminal:
swa start http://localhost:5173 --api-location http://localhost:8080
```

### All-in-One Script (Alternative)

Create a script `start-dev.sh` in repository root:
```bash
#!/bin/bash
# Start Cosmos DB Emulator
cd dev-environment && docker-compose up -d
sleep 30  # Wait for emulator

# Start Backend (background)
cd ../materials/backend && npm run dev &

# Start Frontend (background)
cd ../materials/frontend && npm run dev &

# Wait for services
sleep 5

# Start SWA CLI
swa start http://localhost:5173 --api-location http://localhost:8080
```

### Stop Everything

```bash
# Stop frontend/backend/SWA CLI: Ctrl+C in each terminal

# Stop Cosmos DB Emulator
cd dev-environment && docker-compose stop
```

### Reset Database

```bash
cd dev-environment
docker-compose down -v
docker-compose up -d
# Wait ~60 seconds for emulator restart
```

---

## Troubleshooting

### Cosmos DB Emulator Connection Failed

**Symptom**: Backend shows "MongoDB connection error" or SSL errors

**Solutions**:
1. Verify emulator is running: `docker-compose logs cosmos-emulator`
2. Wait for "Started" message (can take 60+ seconds)
3. Ensure connection string has `tlsAllowInvalidCertificates=true`
4. Check port 10255 is available

### "Emulator taking too long to start"

The Cosmos DB Emulator requires ~3GB RAM. First startup can take 60-90 seconds.

**Solutions**:
1. Ensure Docker Desktop has enough memory allocated (4GB+ recommended)
2. Check logs: `docker-compose logs -f cosmos-emulator`
3. Try restarting: `docker-compose down && docker-compose up -d`

### SWA CLI Not Found

**Symptom**: `swa: command not found`

**Solutions**:
```bash
# Install globally
npm install -g @azure/static-web-apps-cli

# Or use npx
npx @azure/static-web-apps-cli start ...
```

### Auth Emulator Login Page Not Working

**Symptom**: `/.auth/login/aad` shows 404 or real login page

**Solutions**:
1. Ensure you're accessing via http://localhost:4280 (SWA CLI port)
2. Verify SWA CLI is running
3. Clear browser cache/cookies

### CORS Errors

**Symptom**: Browser console shows CORS errors

**Solutions**:
1. Access via http://localhost:4280 (SWA CLI handles routing)
2. If accessing backend directly, ensure `CORS_ORIGINS` includes the origin

### Port Already in Use

**Symptom**: "Error: listen EADDRINUSE: address already in use"

**Solutions**:
```bash
# Find process using the port (e.g., 8080)
lsof -i :8080

# Kill the process
kill -9 <PID>
```

---

## Differences from IaaS Workshop

If you've done the IaaS workshop, here are the key differences:

| Aspect | IaaS | PaaS |
|--------|------|------|
| Entry Point | Direct to Vite (:5173) | SWA CLI (:4280) |
| Database | Docker MongoDB (community) | Cosmos DB Emulator (official) |
| MongoDB Port | 27017 | 10255 |
| Authentication | Real Microsoft Entra ID | SWA Auth Emulator (fake) |
| Backend Port | 3000 | 8080 |

**Why these differences?**
- **SWA CLI**: Emulates Azure Static Web Apps routing and authentication
- **Cosmos DB Emulator**: Official Microsoft tool with same APIs as production
- **Auth Emulator**: No Azure setup needed for local development
- **Port 8080**: Azure App Service default port

---

## Advanced: Using Real Microsoft Entra ID

If you need to test with **real authentication** instead of the fake auth emulator:

### Step A: Microsoft Entra ID Setup

You need **two app registrations** in Azure Portal.

#### A.1 Create Frontend App Registration

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Configure:
   - **Name**: `BlogApp Frontend (Dev)`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Select **Single-page application (SPA)** → Enter `http://localhost:4280`

   > ⚠️ **CRITICAL**: You MUST select "Single-page application (SPA)" - NOT "Web". 
   > MSAL.js uses PKCE flow which only works with SPA platform type.

3. After creation, note:
   - **Application (client) ID** → This is `VITE_ENTRA_CLIENT_ID`
   - **Directory (tenant) ID** → This is `VITE_ENTRA_TENANT_ID`

#### A.2 Create Backend API App Registration

1. Create another app registration:
   - **Name**: `BlogApp API (Dev)`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Leave empty (APIs don't need redirect URIs)
2. After creation, note:
   - **Application (client) ID** → This is `VITE_API_CLIENT_ID` and `ENTRA_CLIENT_ID`

#### A.3 Expose API Scope on Backend App

1. Go to **Backend App** → **Expose an API**
2. Click **Add a scope**:
   - **Application ID URI**: Accept default `api://{client-id}`
   - **Scope name**: `access_as_user`
   - **Who can consent**: Admins and users
   - **Admin consent display name**: `Access BlogApp API`
   - **Admin consent description**: `Allows the app to access BlogApp API on behalf of the signed-in user`
3. Save the scope

#### A.4 Grant Frontend Permission to Call Backend API

1. Go to **Frontend App** → **API permissions**
2. Click **Add a permission** → **My APIs** → Select "BlogApp API (Dev)"
3. Check `access_as_user` → **Add permissions**
4. (Optional) Click **Grant admin consent** for your organization

### Step B: Update Environment Files

Update `.env` files with real Entra ID values:

**materials/backend/.env**:
```bash
ENTRA_TENANT_ID=your-real-tenant-id
ENTRA_CLIENT_ID=your-real-backend-client-id
```

**materials/frontend/.env.local**:
```bash
VITE_ENTRA_CLIENT_ID=your-real-frontend-client-id
VITE_ENTRA_TENANT_ID=your-real-tenant-id
VITE_ENTRA_REDIRECT_URI=http://localhost:4280
VITE_API_CLIENT_ID=your-real-backend-client-id
```

### Step C: Run Without Auth Emulator

You'll need to update the frontend to use MSAL.js for real authentication instead of relying on SWA's auth emulator. This is more complex - see the [Frontend Application Design](../../design/FrontendApplicationDesign.md) for MSAL configuration.

---

## Next Steps

After verifying local development works:

1. **Deploy to Azure**: Follow the [Bicep Deployment Guide](bicep-deployment-guide.md)
2. **Understand the Architecture**: Review [Azure Architecture Design](../../design/AzureArchitectureDesign.md)
3. **Explore the Code**: Check [Backend Design](../../design/BackendApplicationDesign.md) and [Frontend Design](../../design/FrontendApplicationDesign.md)

---

## Related Documentation

- [Local Development Environment Design](../../design/LocalDevelopmentEnvironmentDesign.md)
- [Dev Environment README](../../dev-environment/README.md)
- [Backend README](../backend/README.md)
- [Frontend README](../frontend/README.md)
