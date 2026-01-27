# Frontend Application Design Specification (PaaS)

## Overview

This document defines the frontend application requirements for the Azure PaaS Workshop blog application. The application is deployed on Azure Static Web Apps.

**Reference**: This specification maintains feature compatibility with the [IaaS Workshop Frontend](../iaas/design/FrontendApplicationDesign.md) while adapting deployment patterns for Static Web Apps.

## Application Overview

- **Type**: Multi-user blog application (SPA - Single Page Application)
- **Framework**: React 18+ with TypeScript
- **Styling**: TailwindCSS 3+
- **Authentication**: Microsoft Entra ID OAuth2.0 via MSAL
- **Deployment**: Azure Static Web Apps (global CDN)
- **Target Users**: Workshop students (experienced engineers learning Azure)

---

## Technology Stack (Same as IaaS)

### Core Technologies
- **Frontend Framework**: React 18+
- **Language**: TypeScript 5+ (strict mode)
- **Styling**: TailwindCSS 3+
- **Routing**: React Router v6
- **State Management**: 
  - **Server State**: @tanstack/react-query 5+ (React Query)
  - **Client State**: React Context API
- **HTTP Client**: Axios with interceptors
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library
- **Code Standard**: Google TypeScript Style Guide

### Authentication & Security
- **Authentication Library**: @azure/msal-react, @azure/msal-browser
- **OAuth2.0 Flow**: Authorization Code Flow with PKCE
- **Token Storage**: Session Storage
- **Identity Provider**: Microsoft Entra ID

---

## PaaS-Specific Changes (vs IaaS)

### Summary of Changes

| Aspect | IaaS Implementation | PaaS Implementation | Change Required |
|--------|--------------------|--------------------|-----------------|
| **Hosting** | NGINX on VMs | Azure Static Web Apps | ✅ Deployment method |
| **API Proxy** | NGINX proxy_pass | SWA routes config | ✅ Configuration file |
| **SSL/TLS** | App Gateway cert | SWA built-in SSL | ❌ Automatic |
| **CDN** | None (or manual) | Built-in global CDN | ❌ Automatic |
| **CI/CD** | Manual SCP | GitHub Actions | ✅ Workflow file |
| **Environment** | Build-time VITE_ vars | SWA environment config | ✅ Configuration |
| **Auth Callback** | App Gateway URL | SWA URL | ✅ Redirect URI |

### Files to Add/Modify

1. **`staticwebapp.config.json`** - SWA routing and headers (NEW)
2. **`.github/workflows/azure-static-web-apps.yml`** - CI/CD (NEW)
3. **`src/config/msal.ts`** - Update redirect URI
4. **`src/services/api/client.ts`** - Update API base URL

---

## Static Web Apps Configuration

### staticwebapp.config.json

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.ico", "/*.png", "/*.jpg", "/*.svg"]
  },
  "routes": [
    {
      "route": "/api/*",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "allowedRoles": ["anonymous", "authenticated"],
      "rewrite": "https://<app-gateway-url>/api/*"
    },
    {
      "route": "/login",
      "redirect": "/.auth/login/aad?post_login_redirect_uri=/"
    },
    {
      "route": "/logout",
      "redirect": "/.auth/logout?post_logout_redirect_uri=/"
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/aad?post_login_redirect_uri=/"
    },
    "404": {
      "rewrite": "/index.html"
    }
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://login.microsoftonline.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://login.microsoftonline.com https://*.azurestaticapps.net https://<app-gateway-url>; frame-ancestors 'none'"
  },
  "mimeTypes": {
    ".json": "application/json",
    ".woff2": "font/woff2"
  }
}
```

### Key Configuration Explained

#### Navigation Fallback (SPA Routing)
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*"]
  }
}
```
- All routes not matching static files rewrite to `index.html`
- React Router handles client-side routing
- Same effect as NGINX `try_files $uri $uri/ /index.html`

#### API Proxy Routes
```json
{
  "route": "/api/*",
  "rewrite": "https://<app-gateway-url>/api/*"
}
```
- Frontend calls `/api/posts` 
- SWA proxies to `https://<app-gateway-url>/api/posts`
- Avoids CORS issues (same-origin from browser perspective)

**Note**: Replace `<app-gateway-url>` with actual Application Gateway URL after deployment.

#### Security Headers
Built-in security headers equivalent to NGINX configuration:
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `Content-Security-Policy` - XSS protection

---

## Authentication Configuration

### MSAL Configuration for Static Web Apps

**File**: `src/config/msal.ts`

```typescript
import { Configuration, LogLevel } from '@azure/msal-browser';

// Get configuration from environment or runtime config
const getConfig = () => {
  // For Static Web Apps, use environment variables or fetch from config endpoint
  return {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    tenantId: import.meta.env.VITE_ENTRA_TENANT_ID || '',
    backendClientId: import.meta.env.VITE_ENTRA_BACKEND_CLIENT_ID || '',
    // SWA URL - dynamically determined or from env
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  };
};

export const getMsalConfig = (): Configuration => {
  const config = getConfig();
  
  return {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.redirectUri,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
      },
      allowNativeBroker: false,
    },
  };
};

// Scopes for login
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'User.Read',
    `api://${getConfig().backendClientId}/access_as_user`,
  ],
};

// Scopes for API calls
export const apiRequest = {
  scopes: [`api://${getConfig().backendClientId}/access_as_user`],
};
```

### Environment Variables

**Development** (`.env.local`):
```env
VITE_ENTRA_CLIENT_ID=<frontend-app-registration-id>
VITE_ENTRA_TENANT_ID=<tenant-id>
VITE_ENTRA_BACKEND_CLIENT_ID=<backend-app-registration-id>
VITE_API_URL=/api
VITE_REDIRECT_URI=http://localhost:5173
```

**Production** (SWA Environment Variables):
Set via Azure Portal → Static Web Apps → Configuration → Application settings:

| Name | Value |
|------|-------|
| `VITE_ENTRA_CLIENT_ID` | `<frontend-app-registration-id>` |
| `VITE_ENTRA_TENANT_ID` | `<tenant-id>` |
| `VITE_ENTRA_BACKEND_CLIENT_ID` | `<backend-app-registration-id>` |
| `VITE_API_URL` | `/api` |
| `VITE_REDIRECT_URI` | `https://<swa-name>.azurestaticapps.net` |

---

## API Integration

### API Client Configuration

**File**: `src/services/api/client.ts`

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { msalInstance } from '../auth/msalInstance';
import { apiRequest } from '../../config/msal';

// API base URL - use proxy route for SWA
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const accounts = msalInstance.getAllAccounts();
    
    if (accounts.length > 0) {
      try {
        const response = await msalInstance.acquireTokenSilent({
          ...apiRequest,
          account: accounts[0],
        });
        
        config.headers.Authorization = `Bearer ${response.accessToken}`;
      } catch (error) {
        // Token refresh failed - user needs to re-login
        console.warn('Token refresh failed:', error);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - token expired or invalid
      // Trigger login redirect
      try {
        await msalInstance.acquireTokenRedirect(apiRequest);
      } catch (loginError) {
        console.error('Login redirect failed:', loginError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

### API Service Layer

**File**: `src/services/api/posts.service.ts`

```typescript
import apiClient from './client';
import { Post, CreatePostDTO, UpdatePostDTO, PaginatedResponse } from '../../types/api';

export const postsService = {
  // Get all published posts
  getAll: async (page = 1, pageSize = 10): Promise<PaginatedResponse<Post>> => {
    const response = await apiClient.get('/posts', {
      params: { page, pageSize },
    });
    return response.data;
  },

  // Get single post by slug
  getBySlug: async (slug: string): Promise<Post> => {
    const response = await apiClient.get(`/posts/${slug}`);
    return response.data.data;
  },

  // Get current user's posts
  getMyPosts: async (page = 1, pageSize = 10): Promise<PaginatedResponse<Post>> => {
    const response = await apiClient.get('/posts/my', {
      params: { page, pageSize },
    });
    return response.data;
  },

  // Create new post
  create: async (data: CreatePostDTO): Promise<Post> => {
    const response = await apiClient.post('/posts', data);
    return response.data.data;
  },

  // Update post
  update: async (slug: string, data: UpdatePostDTO): Promise<Post> => {
    const response = await apiClient.put(`/posts/${slug}`, data);
    return response.data.data;
  },

  // Delete post
  delete: async (slug: string): Promise<void> => {
    await apiClient.delete(`/posts/${slug}`);
  },
};
```

---

## Application Features (Same as IaaS)

### Pages

| Page | Path | Auth | Description |
|------|------|------|-------------|
| Home | `/` | Public | List all published posts |
| Post Detail | `/posts/:slug` | Public | View single post with comments |
| Create Post | `/posts/new` | Required | Create new post |
| Edit Post | `/posts/:slug/edit` | Required | Edit existing post (author only) |
| My Posts | `/my-posts` | Required | List user's posts (drafts + published) |
| Profile | `/profile` | Required | View/edit user profile |
| Login | `/login` | Public | Redirect to Entra ID |
| 404 | `*` | Public | Not found page |

### React Router Configuration

**File**: `src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { msalInstance } from './services/auth/msalInstance';
import { AuthGuard } from './components/auth/AuthGuard';
import { Layout } from './components/layout/Layout';

// Pages
import { HomePage } from './pages/HomePage';
import { PostDetailPage } from './pages/PostDetailPage';
import { CreatePostPage } from './pages/CreatePostPage';
import { EditPostPage } from './pages/EditPostPage';
import { MyPostsPage } from './pages/MyPostsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export const App = () => {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Layout>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/posts/:slug" element={<PostDetailPage />} />
              
              {/* Protected routes */}
              <Route element={<AuthGuard />}>
                <Route path="/posts/new" element={<CreatePostPage />} />
                <Route path="/posts/:slug/edit" element={<EditPostPage />} />
                <Route path="/my-posts" element={<MyPostsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              
              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </MsalProvider>
  );
};
```

### Auth Guard Component

**File**: `src/components/auth/AuthGuard.tsx`

```tsx
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginRequest } from '../../config/msal';

export const AuthGuard = () => {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login with return URL
    instance.loginRedirect({
      ...loginRequest,
      state: location.pathname,
    });
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
```

---

## Project Structure

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthGuard.tsx
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── posts/
│   │   │   ├── PostCard.tsx
│   │   │   ├── PostList.tsx
│   │   │   ├── PostForm.tsx
│   │   │   └── CommentSection.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Loading.tsx
│   ├── config/
│   │   └── msal.ts
│   ├── hooks/
│   │   ├── usePosts.ts
│   │   └── useAuth.ts
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── PostDetailPage.tsx
│   │   ├── CreatePostPage.tsx
│   │   ├── EditPostPage.tsx
│   │   ├── MyPostsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── posts.service.ts
│   │   │   └── users.service.ts
│   │   └── auth/
│   │       └── msalInstance.ts
│   ├── types/
│   │   └── api.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── staticwebapp.config.json      # SWA configuration (NEW)
├── .env.example
├── .env.local                    # Local development
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Deployment

### GitHub Actions Workflow

**File**: `.github/workflows/azure-static-web-apps.yml`

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
    paths:
      - 'materials/frontend/**'
      - '.github/workflows/azure-static-web-apps.yml'
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true
      
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/materials/frontend"
          output_location: "dist"
        env:
          VITE_ENTRA_CLIENT_ID: ${{ vars.VITE_ENTRA_CLIENT_ID }}
          VITE_ENTRA_TENANT_ID: ${{ vars.VITE_ENTRA_TENANT_ID }}
          VITE_ENTRA_BACKEND_CLIENT_ID: ${{ vars.VITE_ENTRA_BACKEND_CLIENT_ID }}
          VITE_API_URL: "/api"

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

### Vite Build Configuration

**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          msal: ['@azure/msal-browser', '@azure/msal-react'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

---

## Comparison: IaaS vs PaaS Frontend Deployment

| Aspect | IaaS (NGINX) | PaaS (Static Web Apps) |
|--------|--------------|------------------------|
| **Hosting** | 2 VMs with NGINX | Globally distributed points |
| **Deployment** | SCP + NGINX reload | Git push → GitHub Actions |
| **SSL** | App Gateway cert | Automatic (free) |
| **CDN** | Manual setup | Built-in global distribution (Enterprise edge for 118+ locations) |
| **Custom Domain** | DNS + App Gateway | DNS + SWA portal |
| **Scaling** | Add VMs | Automatic (CDN) |
| **Cost** | ~$60/month (2 VMs) | $0 (Free tier) |
| **CI/CD** | Manual scripts | Built-in GitHub Actions |
| **Proxy Config** | nginx.conf | staticwebapp.config.json |

---

## Entra ID App Registration (Frontend)

### Required Configuration

| Setting | Value |
|---------|-------|
| **Name** | `BlogApp-Frontend-SPA` |
| **Supported Account Types** | Single tenant |
| **Platform** | Single-page application |
| **Redirect URIs** | `https://<swa-name>.azurestaticapps.net` |
| **Redirect URIs (dev)** | `http://localhost:5173` |
| **Implicit Grant** | ❌ Disabled (use PKCE) |
| **API Permissions** | `User.Read`, `api://<backend>/access_as_user` |

### Update After SWA Deployment

After Static Web Apps is deployed, update the Entra ID app registration:

1. Go to Azure Portal → Entra ID → App Registrations
2. Select `BlogApp-Frontend-SPA`
3. Go to Authentication → Add Platform → Single-page application
4. Add redirect URI: `https://<swa-name>.azurestaticapps.net`
5. Save

---

## Local Development

### Setup

```bash
# Navigate to frontend
cd materials/frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
# VITE_ENTRA_CLIENT_ID=...
# VITE_ENTRA_TENANT_ID=...
# VITE_ENTRA_BACKEND_CLIENT_ID=...
# VITE_API_URL=http://localhost:8080/api

# Start development server
npm run dev
```

### Local API Proxy

Vite dev server proxies `/api` requests to local backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
},
```

---

## Testing

### Test Configuration

**File**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Component Test Example

```typescript
// src/components/posts/PostCard.test.tsx
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PostCard } from './PostCard';

const mockPost = {
  _id: '1',
  title: 'Test Post',
  slug: 'test-post',
  excerpt: 'This is a test excerpt',
  authorName: 'John Doe',
  publishedAt: '2026-01-27T10:00:00Z',
  tags: ['test', 'react'],
};

describe('PostCard', () => {
  it('renders post title and excerpt', () => {
    render(
      <BrowserRouter>
        <PostCard post={mockPost} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Post')).toBeInTheDocument();
    expect(screen.getByText('This is a test excerpt')).toBeInTheDocument();
  });

  it('links to post detail page', () => {
    render(
      <BrowserRouter>
        <PostCard post={mockPost} />
      </BrowserRouter>
    );

    const link = screen.getByRole('link', { name: /test post/i });
    expect(link).toHaveAttribute('href', '/posts/test-post');
  });
});
```

---

## Appendix: Migration Checklist (IaaS → PaaS)

- [ ] Create `staticwebapp.config.json` for SWA configuration
- [ ] Update API base URL to use `/api` (proxy route)
- [ ] Update MSAL redirect URI for SWA URL
- [ ] Create GitHub Actions workflow for SWA deployment
- [ ] Set environment variables in SWA portal
- [ ] Update Entra ID app registration with SWA redirect URI
- [ ] Remove NGINX configuration (not needed)
- [ ] Test API proxy configuration
- [ ] Verify authentication flow works with SWA URL
