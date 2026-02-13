#!/bin/bash
# =============================================================================
# Frontend Deployment Script for Azure Static Web Apps
# =============================================================================
# This script builds the frontend, injects runtime config, and deploys
# to Azure Static Web Apps using the SWA CLI.
#
# Prerequisites:
#   - Azure CLI logged in
#   - SWA CLI installed (npm install -g @azure/static-web-apps-cli)
#   - Entra ID app registrations created
#   - Local config file created from template
#
# Setup (one-time):
#   cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env
#   # Edit deploy-frontend.local.env with your Entra ID values
#
# Usage:
#   ./scripts/deploy-frontend.sh <resource-group>
#
# The script will:
#   1. Load Entra ID values from deploy-frontend.local.env
#   2. Query Azure for SWA info
#   3. Build the frontend
#   4. Inject config into index.html (secure - no separate config file)
#   5. Deploy to Static Web Apps
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="$SCRIPT_DIR/deploy-frontend.local.env"
TEMPLATE_ENV_FILE="$SCRIPT_DIR/deploy-frontend.template.env"

# Validate arguments
if [ -z "$RESOURCE_GROUP" ]; then
    echo -e "${RED}Usage: $0 <resource-group>${NC}"
    echo "Example: $0 rg-blogapp-paas"
    exit 1
fi

echo "=============================================="
echo "Frontend Deployment Script (Static Web Apps)"
echo "=============================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "=============================================="

# Step 0: Load Entra ID configuration from local.env file
echo ""
echo -e "${YELLOW}Step 0: Loading Entra ID configuration...${NC}"

if [ -f "$LOCAL_ENV_FILE" ]; then
    echo "  Loading from: $LOCAL_ENV_FILE"
    # Normalize CRLF to LF if file was edited on Windows
    if grep -q $'\r' "$LOCAL_ENV_FILE"; then
        echo "  Detected CRLF line endings; converting to LF..."
        sed -i.bak $'s/\r$//' "$LOCAL_ENV_FILE"
        rm -f "$LOCAL_ENV_FILE.bak"
    fi
    # shellcheck source=/dev/null
    source "$LOCAL_ENV_FILE"
else
    echo -e "${RED}Error: Local configuration file not found.${NC}"
    echo ""
    echo "Please create it from the template:"
    echo "  cp $TEMPLATE_ENV_FILE $LOCAL_ENV_FILE"
    echo ""
    echo "Then edit $LOCAL_ENV_FILE with your Entra ID values."
    exit 1
fi

# Validate required values
if [ -z "$ENTRA_TENANT_ID" ] || [ "$ENTRA_TENANT_ID" = "your-tenant-id-here" ]; then
    echo -e "${RED}Error: ENTRA_TENANT_ID not configured in $LOCAL_ENV_FILE${NC}"
    exit 1
fi

if [ -z "$ENTRA_FRONTEND_CLIENT_ID" ] || [ "$ENTRA_FRONTEND_CLIENT_ID" = "your-frontend-client-id-here" ]; then
    echo -e "${RED}Error: ENTRA_FRONTEND_CLIENT_ID not configured in $LOCAL_ENV_FILE${NC}"
    exit 1
fi

if [ -z "$ENTRA_BACKEND_CLIENT_ID" ] || [ "$ENTRA_BACKEND_CLIENT_ID" = "your-backend-client-id-here" ]; then
    echo -e "${RED}Error: ENTRA_BACKEND_CLIENT_ID not configured in $LOCAL_ENV_FILE${NC}"
    exit 1
fi

echo "  Tenant ID: $ENTRA_TENANT_ID"
echo "  Frontend Client ID: $ENTRA_FRONTEND_CLIENT_ID"
echo "  Backend Client ID: $ENTRA_BACKEND_CLIENT_ID"
echo -e "${GREEN}✅ Entra ID configuration loaded${NC}"

# Ensure we're in the frontend directory
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")/materials/frontend"

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    echo -e "${RED}Error: Cannot find frontend directory at $FRONTEND_DIR${NC}"
    exit 1
fi

cd "$FRONTEND_DIR"
echo "Working directory: $(pwd)"

# Step 1: Query Azure resources
echo ""
echo -e "${YELLOW}Step 1: Querying Azure resources...${NC}"

# Get SWA hostname
SWA_HOSTNAME=$(az staticwebapp list \
    --resource-group "$RESOURCE_GROUP" \
    --query "[0].defaultHostname" -o tsv 2>/dev/null)

if [ -z "$SWA_HOSTNAME" ]; then
    echo -e "${RED}Error: No Static Web App found in resource group $RESOURCE_GROUP${NC}"
    exit 1
fi
echo "  SWA Hostname: $SWA_HOSTNAME"

# Get SWA deployment token
SWA_TOKEN=$(az staticwebapp secrets list \
    --resource-group "$RESOURCE_GROUP" \
    --name "$(az staticwebapp list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv)" \
    --query "properties.apiKey" -o tsv 2>/dev/null)

if [ -z "$SWA_TOKEN" ]; then
    echo -e "${RED}Error: Could not get SWA deployment token${NC}"
    exit 1
fi
echo "  SWA Token: ****$(echo "$SWA_TOKEN" | tail -c 8)"

echo -e "${GREEN}✅ Azure resources found${NC}"

# Step 2: Install dependencies and build
echo ""
echo -e "${YELLOW}Step 2: Building application...${NC}"
npm install
npm run build
echo -e "${GREEN}✅ Build complete${NC}"

# Step 3: Inject config into index.html (more secure than separate config.json)
echo ""
echo -e "${YELLOW}Step 3: Injecting config into index.html...${NC}"

# Create the config JSON (single line for injection)
CONFIG_JSON="{\"ENTRA_TENANT_ID\":\"$ENTRA_TENANT_ID\",\"ENTRA_FRONTEND_CLIENT_ID\":\"$ENTRA_FRONTEND_CLIENT_ID\",\"ENTRA_BACKEND_CLIENT_ID\":\"$ENTRA_BACKEND_CLIENT_ID\",\"API_BASE_URL\":\"/api\"}"

# Replace the placeholder in index.html
# The placeholder is: window.__APP_CONFIG__=null;
sed -i.bak "s|window.__APP_CONFIG__=null;|window.__APP_CONFIG__=$CONFIG_JSON;|g" dist/index.html
rm -f dist/index.html.bak

echo "  Config injected into dist/index.html"
echo -e "${GREEN}✅ Config injected (no separate config.json file)${NC}"

# Step 4: Deploy to Static Web Apps
echo ""
echo -e "${YELLOW}Step 4: Deploying to Static Web Apps...${NC}"

swa deploy ./dist \
    --deployment-token "$SWA_TOKEN" \
    --env production

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo "Frontend URL: https://$SWA_HOSTNAME"
echo ""
echo "Next steps:"
echo "  1. Verify Entra ID Redirect URI includes: https://$SWA_HOSTNAME"
echo "  2. Test the application at: https://$SWA_HOSTNAME"
echo ""
