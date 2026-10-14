# Microsoft Entra ID Setup Guide

This guide explains how to configure Microsoft Entra ID (formerly Azure AD) for the Azure PaaS Workshop blog application.

## Overview

The application requires **two app registrations** in Microsoft Entra ID:

| App Registration | Purpose | Authentication Flow |
|------------------|---------|---------------------|
| **Frontend SPA** | Browser-based authentication | MSAL.js with PKCE |
| **Backend API** | JWT token validation | Validates tokens from Frontend |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Authentication Flow                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐      ┌─────────────────┐      ┌──────────────────────────┐   │
│   │  Browser │──1──▶│ Microsoft Entra │──2──▶│ Browser (with tokens)    │   │
│   │  (MSAL)  │◀─────│ ID Login Page   │      │                          │   │
│   └──────────┘      └─────────────────┘      └──────────────────────────┘   │
│        │                                              │                      │
│        │                                              │ 3. API call with     │
│        │                                              │    Bearer token      │
│        │                                              ▼                      │
│        │                                     ┌──────────────────────┐        │
│        │                                     │  Backend API         │        │
│        │                                     │  (validates JWT)     │        │
│        │                                     └──────────────────────┘        │
│        │                                              │                      │
│        │                                              │ 4. Validate token    │
│        │                                              │    against Entra ID  │
│        │                                              ▼                      │
│        │                                     ┌──────────────────────┐        │
│        └─────────────────────────────────────│ Microsoft Entra ID   │        │
│                                              │ JWKS endpoint        │        │
│                                              └──────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Azure subscription with access to Microsoft Entra ID
- **Application Developer** in the target tenant, activated through PIM if applicable, for creating and configuring your own isolated workshop applications and consenting for yourself.
- Azure Owner / Contributor is separate from Entra permissions. Application Administrator / Cloud Application Administrator / Global Administrator and tenant-wide consent are not prerequisites for the learner path.

Use the [Cloud Shell Day 0 guide](../materials/docs/learner/day-0-entra-id.ja.md) as the canonical command path. The portal steps below explain the same registration settings. Self-consent remains subject to applicable policies, scopes and the CLI's Graph authorization; stop and diagnose actual errors instead of escalating roles or changing tenant policies.

## Step 1: Get Your Tenant ID

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** > **Overview**
3. Copy the **Tenant ID** (a GUID like `12345678-1234-1234-1234-123456789abc`)

Save this value - you'll need it for both app registrations.

## Step 2: Create Backend API App Registration

### 2.1 Create the App Registration

1. Go to **Microsoft Entra ID** > **App registrations**
2. Click **+ New registration**
3. Fill in the form:
   - **Name**: `PaaS BlogApp Backend API` (or your preferred name)
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Leave blank (backend doesn't need redirect)
4. Click **Register**

### 2.2 Note the Application (Client) ID

After registration, you'll see the **Overview** page:
- Copy the **Application (client) ID** - this is your `ENTRA_CLIENT_ID` for the backend

### 2.3 Expose an API (Create Scope)

1. Go to **Expose an API** in the left menu
2. Click **+ Add a scope**
3. If prompted for Application ID URI, accept the default (`api://<client-id>`) or customize it
4. Create a scope:
   - **Scope name**: `access_as_user`
   - **Who can consent**: `Admins and users`
   - **Admin consent display name**: `Access BlogApp API`
   - **Admin consent description**: `Allows the app to access BlogApp API on behalf of the signed-in user`
   - **User consent display name**: `Access BlogApp API`
   - **User consent description**: `Allows the app to access BlogApp API on your behalf`
   - **State**: `Enabled`
5. Click **Add scope**

Note the full scope value: `api://<client-id>/access_as_user`

### 2.4 Summary - Backend Values

| Setting | Where to Find | Environment Variable |
|---------|---------------|---------------------|
| Tenant ID | Entra ID > Overview | `ENTRA_TENANT_ID` |
| Client ID | App registration > Overview | `ENTRA_CLIENT_ID` |

## Step 3: Create Frontend SPA App Registration

### 3.1 Create the App Registration

1. Go to **Microsoft Entra ID** > **App registrations**
2. Click **+ New registration**
3. Fill in the form:
   - **Name**: `PaaS BlogApp Frontend SPA` (or your preferred name)
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: 
     - Type: `Single-page application (SPA)`
     - URI: `http://localhost:5173`
4. Click **Register**

> **Note**: We'll add `http://localhost:4280` (for SWA CLI emulator) in Step 3.3.

### 3.2 Note the Application (Client) ID

After registration:
- Copy the **Application (client) ID** - this is your `VITE_ENTRA_CLIENT_ID`

### 3.3 Add Additional Redirect URIs

For both local development and production, add multiple redirect URIs:

1. Go to **Authentication** in the left menu
2. Under **Single-page application** > **Redirect URIs**, click **Add URI**
3. Add these URIs:
   ```
   http://localhost:5173                      # Local development (Vite direct)
   http://localhost:4280                      # Local development (SWA CLI emulator)
   https://your-swa-name.azurestaticapps.net  # Production (add after deployment)
   ```
4. Click **Save**

> **When to use which URI:**
> - `localhost:5173` - Direct Vite dev server (simpler, faster hot reload)
> - `localhost:4280` - SWA CLI emulator (matches production SWA behavior)

### 3.4 Configure API Permissions

1. Go to **API permissions** in the left menu
2. Click **+ Add a permission**
3. Select **My APIs** tab
4. Select **BlogApp Backend API** (the app you created in Step 2)
5. Select **Delegated permissions**
6. Check `access_as_user`
7. Click **Add permissions**

Your API permissions should now show:
- `Microsoft Graph` > `User.Read` (default)
- `PaaS BlogApp Backend API` > `access_as_user`

### 3.5 Grant Consent for the Signed-In Learner

Follow [Day 0 section 4](../materials/docs/learner/day-0-entra-id.ja.md): resolve your user object ID with `az ad signed-in-user show`, create service principals for your owned applications if absent, and use the guarded `az ad app permission grant` with **`--consent-type Principal --principal-id "$USER_OBJECT_ID"`**.

Do not omit `--consent-type`: its default is `AllPrincipals`, which Application Developer alone cannot grant. The CLI may replace existing grants for the same client/resource; use the entire guard, not an isolated grant command, and never share this application pair for parallel consent operations.

Verify `clientId` and `resourceId` against the Frontend and Backend **service principal object IDs**, `scope` includes `access_as_user`, `consentType` is `Principal`, and `principalId` is the signed-in user's object ID. A complete existing self-grant is reused; conflicting grants are left unchanged. Sign in as the same user on Day 1. A consent prompt need not reappear after the Day 0 grant.

### 3.6 Summary - Frontend Values

| Setting | Where to Find | Environment Variable |
|---------|---------------|---------------------|
| Tenant ID | Entra ID > Overview | `VITE_ENTRA_TENANT_ID` |
| Frontend Client ID | Frontend app > Overview | `VITE_ENTRA_CLIENT_ID` |
| Backend Client ID | Backend app > Overview | `VITE_API_CLIENT_ID` |
| Redirect URI | Frontend app > Authentication | `VITE_ENTRA_REDIRECT_URI` |

## Step 4: Configure Environment Files

### Backend `.env`

```env
# Microsoft Entra ID - REQUIRED
ENTRA_TENANT_ID=12345678-1234-1234-1234-123456789abc
ENTRA_CLIENT_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
```

### Frontend `.env.local`

```env
# Microsoft Entra ID - REQUIRED
VITE_ENTRA_CLIENT_ID=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
VITE_ENTRA_TENANT_ID=12345678-1234-1234-1234-123456789abc
VITE_ENTRA_REDIRECT_URI=http://localhost:5173

# Backend API (for token scope)
VITE_API_CLIENT_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
```

## Step 5: Verify Configuration

### Test Login Flow

1. Start the backend: `cd materials/backend && npm run dev`
2. Start the frontend: `cd materials/frontend && npm run dev`
3. Open http://localhost:5173
4. Click "Sign In"
5. You should be redirected to Microsoft login page
6. After authentication, you should be redirected back to the app

### Common Issues

#### "AADSTS50011: The redirect URI is not valid"

**Cause**: Redirect URI mismatch between app registration and MSAL config.

**Fix**: 
1. Check that `http://localhost:5173` is added in **Authentication** > **Redirect URIs**
2. Ensure `VITE_ENTRA_REDIRECT_URI` matches exactly (including http vs https)

#### "AADSTS700016: Application not found"

**Cause**: Wrong Client ID or Tenant ID.

**Fix**: Double-check the IDs in your `.env` files match the Azure Portal.

#### "401 Unauthorized" on API calls

**Cause**: Backend token validation failing.

**Fix**:
1. Verify `ENTRA_CLIENT_ID` in backend `.env` matches the Backend API app registration
2. Check that the Frontend has `access_as_user` permission for the Backend API
3. Ensure the token includes the correct audience

#### "Consent required" error

**Cause**: User hasn't consented to API permissions.

**Fix**:
1. Check the current tenant, user, Application Developer activation, owned applications, and the Principal grant using the guarded Day 0 procedure.
2. If browser consent is requested for an additional permission, the user must review it themselves. If approval is required or CLI consent is denied, record the actual error and diagnose applicable policy and Graph authorization. Do not use tenant-wide admin consent as an automatic fallback.

## Production Configuration

When deploying to Azure:

### Static Web Apps (Frontend)

Add these as **Application Settings**:
- `VITE_ENTRA_CLIENT_ID`: Frontend SPA Client ID
- `VITE_ENTRA_TENANT_ID`: Your Tenant ID
- `VITE_ENTRA_REDIRECT_URI`: `https://your-swa-name.azurestaticapps.net`
- `VITE_API_CLIENT_ID`: Backend API Client ID

Don't forget to add the production URL to Frontend SPA's redirect URIs in Azure Portal!

### App Service (Backend)

Add these as **Application Settings** (or use Key Vault references):
- `ENTRA_TENANT_ID`: Your Tenant ID
- `ENTRA_CLIENT_ID`: Backend API Client ID

## Security Best Practices

1. **Use separate app registrations** for Frontend and Backend
2. **Don't expose client secrets** - SPA uses PKCE, no secrets needed
3. **Limit redirect URIs** - Only add URIs you actually use
4. **Use Principal self-consent** for the isolated learner application; do not grant tenant-wide consent merely to suppress prompts
5. **Review permissions** regularly and remove unused ones

## Quick Reference

### Values You Need

| Value | Where to Get | Used In |
|-------|--------------|---------|
| Tenant ID | Entra ID > Overview | Both Frontend and Backend |
| Frontend Client ID | Frontend app > Overview | Frontend `.env.local` |
| Backend Client ID | Backend app > Overview | Frontend `.env.local` AND Backend `.env` |
| Redirect URI | Set in Frontend app | Frontend `.env.local` |

### Azure Portal Locations

| Task | Location |
|------|----------|
| Create app registration | Entra ID > App registrations > + New registration |
| Add redirect URI | App registration > Authentication |
| Add API permissions | App registration > API permissions |
| Expose an API | App registration > Expose an API |
| Verify Principal self-consent | Guarded Cloud Shell commands in Day 0 section 4; API permissions configuration alone is not the grant |

## Related Documents

- [Local Development Environment Design](../design/LocalDevelopmentEnvironmentDesign.md)
- [Backend Application Design](../design/BackendApplicationDesign.md)
- [Frontend Application Design](../design/FrontendApplicationDesign.md)
- [Materials Validation Strategy](../design/MaterialsValidationStrategy.md)
