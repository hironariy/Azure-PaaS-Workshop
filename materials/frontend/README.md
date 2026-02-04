# Frontend Application - Azure PaaS Workshop

React SPA deployed to Azure Static Web Apps with Microsoft Entra ID authentication.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

### Local Development

1. Copy `.env.example` to `.env.local`
2. Fill in your Entra ID application values:

```env
VITE_ENTRA_CLIENT_ID=your-frontend-spa-client-id
VITE_ENTRA_TENANT_ID=your-tenant-id
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
VITE_API_CLIENT_ID=your-backend-api-client-id
```

### Production (Static Web Apps)

In production, configuration is loaded from `/config.json`:

```json
{
  "ENTRA_TENANT_ID": "your-tenant-id",
  "ENTRA_FRONTEND_CLIENT_ID": "your-frontend-client-id",
  "ENTRA_BACKEND_CLIENT_ID": "your-backend-client-id",
  "API_BASE_URL": "/api"
}
```

This file can be:
- Created during deployment via Bicep
- Served from API endpoint
- Static file in SWA

## IaaS vs PaaS Differences

This frontend code is **virtually identical** to the IaaS Workshop version, demonstrating that Azure PaaS requires minimal code changes.

### Code Differences Summary

| File | Change | Description |
|------|--------|-------------|
| `staticwebapp.config.json` | **NEW** | SWA routing config (replaces NGINX) |
| `vite.config.ts` | Port | Proxy to 8080 (PaaS) vs 3000 (IaaS) |
| `index.html` | Title | "PaaS" instead of "IaaS" |
| `components/Layout.tsx` | Footer | "PaaS Workshop" instead of "IaaS" |
| `pages/ProfilePage.tsx` | Info text | "PaaS Workshop" instead of "IaaS" |

### Infrastructure Differences (Zero Code Impact)

| Aspect | IaaS | PaaS |
|--------|------|------|
| **Hosting** | NGINX on Ubuntu VM | Azure Static Web Apps |
| **CDN** | Manual Azure CDN setup | Built-in global CDN |
| **SSL** | Let's Encrypt + certbot | Automatic SSL |
| **Routing** | NGINX config | staticwebapp.config.json |
| **Deployment** | SCP to VM | GitHub Actions |
| **Scaling** | Manual VM scaling | Automatic |
| **Cost** | VM compute cost | Free tier available |

### Key Files Identical to IaaS

These files are **100% identical** between IaaS and PaaS:

- `src/main.tsx` - Application bootstrap
- `src/App.tsx` - Routing
- `src/config/appConfig.ts` - Runtime config pattern
- `src/config/authConfig.ts` - MSAL configuration
- `src/config/msalInstance.ts` - MSAL singleton
- `src/services/api.ts` - API client
- `src/pages/HomePage.tsx`
- `src/pages/PostPage.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/CreatePostPage.tsx`
- `src/pages/EditPostPage.tsx`
- `src/pages/MyPostsPage.tsx`
- `src/index.css` - Styles

## Static Web Apps Configuration

The `staticwebapp.config.json` file handles routing that NGINX did in IaaS:

```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/images/*", "/*.{css,js,json,png,jpg,svg}"]
  }
}
```

This provides:
- SPA routing (all routes → index.html)
- API passthrough
- Static asset handling

## Project Structure

```
frontend/
├── src/
│   ├── config/           # Runtime configuration
│   │   ├── appConfig.ts  # Config loading (dev/prod)
│   │   ├── authConfig.ts # MSAL configuration
│   │   └── msalInstance.ts # MSAL singleton
│   ├── components/
│   │   └── Layout.tsx    # Common layout
│   ├── pages/            # Route pages
│   │   ├── HomePage.tsx
│   │   ├── PostPage.tsx
│   │   ├── CreatePostPage.tsx
│   │   ├── EditPostPage.tsx
│   │   ├── MyPostsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── LoginPage.tsx
│   ├── services/
│   │   └── api.ts        # Backend API client
│   ├── App.tsx           # Routing
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── staticwebapp.config.json  # SWA routing (NEW for PaaS)
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Deployment

### Azure Static Web Apps (Recommended)

1. Push code to GitHub
2. GitHub Actions automatically builds and deploys
3. SWA provides:
   - Global CDN
   - Free SSL
   - Preview environments for PRs
   - API integration

### Manual Build

```bash
npm run build
# Output in dist/ folder
```

## Development Notes

### API Proxy in Development

Vite proxies API requests to the backend:

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8080',  // PaaS uses 8080
    changeOrigin: true,
  }
}
```

IaaS version uses port 3000 - this is the only difference.

### Authentication Flow

1. User clicks "Sign In"
2. MSAL redirects to Microsoft login
3. User authenticates with Entra ID
4. Redirect back with tokens
5. Tokens stored in sessionStorage (not localStorage for security)
6. API calls include Bearer token

This flow is identical between IaaS and PaaS.

## Troubleshooting

### "Failed to load /config.json"

In production, ensure `/config.json` exists and is served by SWA.

### CORS errors in development

Check that backend is running on port 8080 (PaaS) or 3000 (IaaS).

### Authentication redirect issues

Verify `VITE_ENTRA_REDIRECT_URI` matches your Entra ID app registration.

## Related Documentation

- [Frontend Design](/design/FrontendApplicationDesign.md)
- [Backend API](/materials/backend/README.md)
- [Bicep Deployment](/materials/bicep/README.md)
