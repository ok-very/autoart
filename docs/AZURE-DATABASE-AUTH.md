# Azure Database Authentication

**Part of:** [Architecture Documentation Series](./ARCHITECTURE-00-INDEX.md)  
**Last Updated:** 2026-01-31

## Overview

AutoArt supports two database authentication modes:

| Mode | Environment | Authentication | Config Required |
|------|-------------|----------------|-----------------|
| **Development** | Local | Password-based | `DATABASE_URL` |
| **Production** | Cloud/CI | Azure Entra ID | `AZURE_AD_USER` |

## How It Works

### Development Mode (`NODE_ENV=development`)

Uses a traditional PostgreSQL connection string with username/password:

```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/autoart
```

### Production Mode (`NODE_ENV=production`)

Uses Azure Entra ID (formerly Azure AD) token-based authentication:

```env
NODE_ENV=production
AZURE_AD_USER=user@yourdomain.com
```

The backend acquires an OAuth token via `DefaultAzureCredential` and uses it as the database password. Tokens are automatically refreshed before expiration.

## Architecture

```mermaid
sequenceDiagram
    participant App as Backend Server
    participant Azure as Azure Identity
    participant DB as Azure PostgreSQL

    Note over App: Startup (production mode)
    App->>Azure: getToken('ossrdbms-aad.database.windows.net')
    Azure-->>App: OAuth Token (expires in ~1hr)
    App->>DB: Connect with token as password
    DB-->>App: Connection established

    Note over App: Before token expiry
    App->>Azure: Refresh token
    Azure-->>App: New token
    App->>DB: Reconnect with new token
```

## Deployment Configurations

### Render / Railway / Fly.io

These platforms support **Managed Identity** or **Service Principal** authentication.

#### Option 1: Service Principal (Recommended for PaaS)

1. Create a Service Principal in Azure:
   ```bash
   az ad sp create-for-rbac --name "autoart-backend" --role contributor
   ```

2. Set environment variables on your hosting platform:
   ```env
   NODE_ENV=production
   AZURE_AD_USER=your-app@yourdomain.com
   AZURE_CLIENT_ID=<service-principal-app-id>
   AZURE_CLIENT_SECRET=<service-principal-secret>
   AZURE_TENANT_ID=<your-tenant-id>
   ```

3. Grant the Service Principal access to Azure PostgreSQL:
   ```sql
   -- Run as Azure AD admin on the database
   SELECT * FROM pgaadauth_create_principal('your-app@yourdomain.com', false, false);
   ```

#### Option 2: Managed Identity (Azure-hosted only)

For Azure App Service, Container Apps, or AKS:

1. Enable system-assigned managed identity on your resource
2. Grant the identity access to PostgreSQL:
   ```sql
   SELECT * FROM pgaadauth_create_principal('<managed-identity-name>', false, false);
   ```
3. Set environment variables:
   ```env
   NODE_ENV=production
   AZURE_AD_USER=<managed-identity-name>
   ```

No client secret needed—Azure handles authentication automatically.

### Local Development with Azure Database

To test Azure authentication locally:

1. Install Azure CLI:
   ```bash
   # Windows
   winget install Microsoft.AzureCLI
   
   # macOS
   brew install azure-cli
   ```

2. Login to Azure:
   ```bash
   az login
   ```

3. Set your `.env`:
   ```env
   NODE_ENV=production
   AZURE_AD_USER=your-email@yourdomain.com
   ```

4. Run the dev server:
   ```bash
   pnpm dev:win  # or pnpm dev on Unix
   ```

> **Note:** On Windows, the `dev.ps1` script automatically adds Azure CLI to PATH.

## Database Client Implementation

Located in `backend/src/db/client.ts`:

```typescript
// Key functions:

initializeDatabase()    // Called at app startup, acquires token in production
createPool()            // Creates pg Pool with appropriate auth
ensureFreshToken()      // Refreshes token before queries if expiring soon
```

### Token Refresh Strategy

- Tokens expire after ~1 hour
- Auto-refresh triggers 5 minutes before expiration
- On refresh, a new connection pool is created
- Existing queries complete on old pool before it closes

## Azure PostgreSQL Setup

### 1. Enable Entra ID Authentication

```bash
az postgres flexible-server update \
  --resource-group <rg> \
  --name <server-name> \
  --active-directory-auth Enabled
```

### 2. Set an Azure AD Administrator

```bash
az postgres flexible-server ad-admin create \
  --resource-group <rg> \
  --server-name <server-name> \
  --display-name "DB Admin" \
  --object-id <user-or-group-object-id>
```

### 3. Grant Access to Application Identity

Connect as the Azure AD admin and run:

```sql
-- For a user
SELECT * FROM pgaadauth_create_principal('user@yourdomain.com', false, false);

-- For a service principal
SELECT * FROM pgaadauth_create_principal('app-name', false, false);

-- Grant privileges
GRANT ALL ON ALL TABLES IN SCHEMA public TO "user@yourdomain.com";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "user@yourdomain.com";
```

## Troubleshooting

### "Failed to acquire Azure AD token"

- **Local:** Run `az login` and ensure you're logged in as the correct user
- **CI/Cloud:** Verify `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` are set
- **Azure-hosted:** Ensure managed identity is enabled

### "az is not recognized"

Add Azure CLI to your PATH:
- **Windows:** `C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin`
- **macOS/Linux:** Usually at `/usr/local/bin/az`

On Windows, the `scripts/dev.ps1` handles this automatically.

### "password authentication failed"

The user in `AZURE_AD_USER` must be granted access in PostgreSQL:
```sql
SELECT * FROM pgaadauth_create_principal('user@yourdomain.com', false, false);
```

### Token Expiration Errors

If you see auth errors after running for a while, check that `ensureFreshToken()` is being called. The token refresh runs automatically, but in edge cases you may need to restart the server.

## Security Considerations

1. **No passwords in code or config** - Tokens are acquired at runtime
2. **Short-lived tokens** - Compromise window is ~1 hour max
3. **Centralized identity management** - Use Azure AD groups for access control
4. **Audit logging** - Azure provides auth logs in Monitor

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `DATABASE_URL` | Dev only | PostgreSQL connection string |
| `AZURE_AD_USER` | Prod only | Azure AD user or service principal name |
| `AZURE_CLIENT_ID` | CI/PaaS | Service principal application ID |
| `AZURE_CLIENT_SECRET` | CI/PaaS | Service principal secret |
| `AZURE_TENANT_ID` | CI/PaaS | Azure tenant ID |
| `DATABASE_POOL_SIZE` | Optional | Max connections (default: 10) |

## Related Documentation

- [Backend Architecture](./ARCHITECTURE-01-BACKEND.md)
- [Azure Identity SDK](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/)
- [Azure PostgreSQL Entra Auth](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-configure-sign-in-azure-ad-authentication)
