#!/bin/bash
# =============================================================================
# Backend Deployment Script with Retry Logic
# =============================================================================
# This script deploys the backend to Azure App Service with proper handling
# for the expected 60-90 second startup time (VNet + Key Vault initialization).
#
# Usage:
#   ./scripts/deploy-backend.sh <resource-group> <app-service-name>
#
# Example:
#   ./scripts/deploy-backend.sh rg-blogapp-dev app-blogapp-abc123
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${1:-}"
APP_SERVICE_NAME="${2:-}"
MAX_RETRIES=20
RETRY_INTERVAL=15
DEPLOY_TIMEOUT=120

# Validate arguments
if [ -z "$RESOURCE_GROUP" ] || [ -z "$APP_SERVICE_NAME" ]; then
    echo -e "${RED}Usage: $0 <resource-group> <app-service-name>${NC}"
    echo "Example: $0 rg-blogapp-dev app-blogapp-abc123"
    exit 1
fi

echo "=============================================="
echo "Backend Deployment Script"
echo "=============================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "App Service: $APP_SERVICE_NAME"
echo "=============================================="

# Ensure we're in the backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")/materials/backend"

if [ ! -f "$BACKEND_DIR/package.json" ]; then
    echo -e "${RED}Error: Cannot find backend directory at $BACKEND_DIR${NC}"
    exit 1
fi

cd "$BACKEND_DIR"
echo "Working directory: $(pwd)"

# Step 1: Build the application
echo ""
echo -e "${YELLOW}Step 1: Building application...${NC}"
npm install
npm run build
echo -e "${GREEN}✅ Build complete${NC}"

# Step 2: Create deployment package
echo ""
echo -e "${YELLOW}Step 2: Creating deployment package...${NC}"
cp package.json package-lock.json dist/
cd dist
npm ci --omit=dev
zip -r ../deploy.zip .
cd ..
echo -e "${GREEN}✅ Deployment package created (deploy.zip)${NC}"

# Step 3: Configure App Service build & startup
echo ""
echo -e "${YELLOW}Step 3: Configuring App Service...${NC}"

# Disable remote build (prevents tsc not found on server)
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME" \
    --settings "SCM_DO_BUILD_DURING_DEPLOYMENT=false" \
    >/dev/null

# Set startup command (pre-built package has src/app.js at root)
az webapp config set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME" \
    --startup-file "node src/app.js" \
    >/dev/null

echo -e "${GREEN}✅ App Service configured${NC}"

# Step 4: Deploy to App Service
echo ""
echo -e "${YELLOW}Step 4: Deploying to App Service...${NC}"
echo "Note: Ignoring deployment timeout - startup takes 60-90 seconds"

# Deploy with short timeout (just upload the zip)
az webapp deploy \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME" \
    --src-path deploy.zip \
    --type zip \
    --clean true \
    --restart true \
    --timeout "$DEPLOY_TIMEOUT" 2>&1 || true

echo -e "${YELLOW}Deployment command complete (may have timed out, which is expected)${NC}"

# Step 5: Wait for app to be healthy
echo ""
echo -e "${YELLOW}Step 5: Waiting for app to start (this may take 60-90 seconds)...${NC}"

HEALTH_URL="https://$APP_SERVICE_NAME.azurewebsites.net/health"
echo "Health endpoint: $HEALTH_URL"

for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES..."
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo ""
        echo -e "${GREEN}✅ App is healthy! (HTTP $HTTP_CODE)${NC}"
        echo ""
        echo "Health check response:"
        curl -s "$HEALTH_URL" | jq .
        echo ""
        echo "=============================================="
        echo -e "${GREEN}Deployment successful!${NC}"
        echo "App URL: https://$APP_SERVICE_NAME.azurewebsites.net"
        echo "=============================================="
        
        # Cleanup
        rm -f deploy.zip
        exit 0
    fi
    
    echo "  Status: HTTP $HTTP_CODE (waiting ${RETRY_INTERVAL}s...)"
    sleep "$RETRY_INTERVAL"
done

# Deployment failed
echo ""
echo -e "${RED}❌ App failed to start after $((MAX_RETRIES * RETRY_INTERVAL)) seconds${NC}"
echo ""
echo "Troubleshooting steps:"
echo "1. Check application logs:"
echo "   az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME"
echo ""
echo "2. Download logs for analysis:"
echo "   az webapp log download --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME --log-file /tmp/app-logs.zip"
echo ""
echo "3. Check Key Vault RBAC:"
echo "   az role assignment list --assignee \$(az webapp identity show --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME --query principalId -o tsv) --query '[].roleDefinitionName'"

# Cleanup
rm -f deploy.zip
exit 1
