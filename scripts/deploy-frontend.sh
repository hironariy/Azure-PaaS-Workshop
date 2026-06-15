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
#   - Frontend config file created from template
#
# Setup (one-time):
#   mkdir -p "$HOME/clouddrive/paas-workshop"
#   cp scripts/deploy-frontend.template.env "$HOME/clouddrive/paas-workshop/deploy-frontend.local.env"
#   # Edit deploy-frontend.local.env with your Entra ID values
#
# Usage:
#   ./scripts/deploy-frontend.sh <resource-group>
#
# The script will:
#   1. Load Entra ID values from the Cloud Shell state or repo-local deploy-frontend.local.env
#   2. Query Azure for SWA info
#   3. Build the frontend
#   4. Copy Static Web Apps routing config
#   5. Inject config into index.html (secure - no separate config file)
#   6. Deploy to Static Web Apps
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
STATE_ENV_FILE="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}/deploy-frontend.local.env"
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

# Step 0: Load Entra ID configuration from frontend env file
echo ""
echo -e "${YELLOW}Step 0: Loading Entra ID configuration...${NC}"

ENV_SOURCE_FILE=""
if [ -f "$STATE_ENV_FILE" ]; then
    ENV_SOURCE_FILE="$STATE_ENV_FILE"
elif [ -f "$LOCAL_ENV_FILE" ]; then
    ENV_SOURCE_FILE="$LOCAL_ENV_FILE"
fi

if [ -n "$ENV_SOURCE_FILE" ]; then
    echo "  Loading from: $ENV_SOURCE_FILE"
    # Normalize CRLF to LF if file was edited on Windows
    if grep -q $'\r' "$ENV_SOURCE_FILE"; then
        echo "  Detected CRLF line endings; converting to LF..."
        sed -i.bak $'s/\r$//' "$ENV_SOURCE_FILE"
        rm -f "$ENV_SOURCE_FILE.bak"
    fi
    # shellcheck source=/dev/null
    source "$ENV_SOURCE_FILE"
else
    echo -e "${RED}Error: Frontend configuration file not found.${NC}"
    echo ""
    echo "Please create it in the Cloud Shell state directory:"
    echo "  mkdir -p $(dirname "$STATE_ENV_FILE")"
    echo "  cp $TEMPLATE_ENV_FILE $STATE_ENV_FILE"
    echo ""
    echo "Or create the legacy repo-local file:"
    echo "  cp $TEMPLATE_ENV_FILE $LOCAL_ENV_FILE"
    echo ""
    echo "Then edit the file with your Entra ID values."
    exit 1
fi

# Validate required values
validate_config_value() {
    local name="$1"
    local value="$2"
    local placeholder="$3"

    if [ -z "$value" ] || [ "$value" = "$placeholder" ] || [ "$value" = "null" ] || [ "$value" = "undefined" ]; then
        echo -e "${RED}Error: $name is not configured in $ENV_SOURCE_FILE${NC}"
        exit 1
    fi
}

validate_config_value "ENTRA_TENANT_ID" "$ENTRA_TENANT_ID" "your-tenant-id-here"
validate_config_value "ENTRA_FRONTEND_CLIENT_ID" "$ENTRA_FRONTEND_CLIENT_ID" "your-frontend-client-id-here"
validate_config_value "ENTRA_BACKEND_CLIENT_ID" "$ENTRA_BACKEND_CLIENT_ID" "your-backend-client-id-here"

GUID_PATTERN='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

if ! printf '%s' "$ENTRA_TENANT_ID" | grep -Eq "$GUID_PATTERN"; then
    echo -e "${RED}Error: ENTRA_TENANT_ID not configured in $ENV_SOURCE_FILE${NC}"
    exit 1
fi

if ! printf '%s' "$ENTRA_FRONTEND_CLIENT_ID" | grep -Eq "$GUID_PATTERN"; then
    echo -e "${RED}Error: ENTRA_FRONTEND_CLIENT_ID must be an application client ID GUID in $ENV_SOURCE_FILE${NC}"
    exit 1
fi

if ! printf '%s' "$ENTRA_BACKEND_CLIENT_ID" | grep -Eq "$GUID_PATTERN"; then
    echo -e "${RED}Error: ENTRA_BACKEND_CLIENT_ID must be an application client ID GUID in $ENV_SOURCE_FILE${NC}"
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

# Step 3: Copy Static Web Apps routing config
echo ""
echo -e "${YELLOW}Step 3: Copying Static Web Apps config...${NC}"

if [ -f "staticwebapp.config.json" ]; then
    cp staticwebapp.config.json dist/staticwebapp.config.json
    echo "  staticwebapp.config.json copied to dist/"
else
    echo -e "${RED}Error: staticwebapp.config.json not found in $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Static Web Apps config copied${NC}"

# Step 4: Inject config into index.html (more secure than separate config.json)
echo ""
echo -e "${YELLOW}Step 4: Injecting config into index.html...${NC}"

ENTRA_TENANT_ID="$ENTRA_TENANT_ID" \
ENTRA_FRONTEND_CLIENT_ID="$ENTRA_FRONTEND_CLIENT_ID" \
ENTRA_BACKEND_CLIENT_ID="$ENTRA_BACKEND_CLIENT_ID" \
node <<'NODE'
const fs = require('fs');

const indexPath = 'dist/index.html';
const config = {
  ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID,
  ENTRA_FRONTEND_CLIENT_ID: process.env.ENTRA_FRONTEND_CLIENT_ID,
  ENTRA_BACKEND_CLIENT_ID: process.env.ENTRA_BACKEND_CLIENT_ID,
  API_BASE_URL: '/api',
};

const missing = Object.entries(config)
  .filter(([key, value]) => key !== 'API_BASE_URL' && (!value || value.trim() === ''))
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Error: Missing config values: ${missing.join(', ')}`);
  process.exit(1);
}

const assignment = `window.__APP_CONFIG__=${JSON.stringify(config)};`;
const assignmentPattern = /window\.__APP_CONFIG__\s*=\s*(?:null|undefined|\{[^<]*?\}|)\s*;/;
const html = fs.readFileSync(indexPath, 'utf8');

if (!assignmentPattern.test(html)) {
  console.error('Error: Could not find window.__APP_CONFIG__ placeholder in dist/index.html.');
  process.exit(1);
}

const updated = html.replace(assignmentPattern, assignment);
fs.writeFileSync(indexPath, updated);

const verified = fs.readFileSync(indexPath, 'utf8');
if (!verified.includes(`"ENTRA_FRONTEND_CLIENT_ID":"${config.ENTRA_FRONTEND_CLIENT_ID}"`)) {
  console.error('Error: Config injection verification failed for ENTRA_FRONTEND_CLIENT_ID.');
  process.exit(1);
}

if (/window\.__APP_CONFIG__\s*=\s*(?:null|undefined|)\s*;/.test(verified)) {
  console.error('Error: Config injection left an empty or null window.__APP_CONFIG__ assignment.');
  process.exit(1);
}
NODE

echo "  Config injected and verified in dist/index.html"
echo -e "${GREEN}✅ Config injected (no separate config.json file)${NC}"

# Step 5: Deploy to Static Web Apps
echo ""
echo -e "${YELLOW}Step 5: Deploying to Static Web Apps...${NC}"

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
