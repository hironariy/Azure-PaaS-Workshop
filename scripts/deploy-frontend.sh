#!/bin/bash
# Usage: ./scripts/deploy-frontend.sh <saved-resource-group>
# Legacy CLI route; the ARM candidate is deploy-frontend-arm.sh (no automatic fallback).

set +x
set -euo pipefail
unset SWA_CLI_DEPLOYMENT_TOKEN SWA_TOKEN
trap 'unset SWA_TOKEN' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESOURCE_GROUP="${1:-}"
if [ -z "$RESOURCE_GROUP" ] || [ "$#" -ne 1 ]; then
    echo "Usage: $0 <saved-resource-group>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="$SCRIPT_DIR/deploy-frontend.local.env"
STATE_ENV_FILE="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}/deploy-frontend.local.env"

if [ -f "$SCRIPT_DIR/workshop-deploy-common.sh" ] && [ ! -f "$STATE_ENV_FILE" ] && [ ! -f "$LOCAL_ENV_FILE" ]; then
    source "$SCRIPT_DIR/workshop-deploy-common.sh"
    workshop_deploy_load_target "$RESOURCE_GROUP"
    export ENTRA_TENANT_ID="$TENANT_ID"
    export ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
    export ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
    FRONTEND_DIR="$WORKSHOP_REPO_DIR/materials/frontend"
    cd "$FRONTEND_DIR"

    ACTUAL_HOSTNAME="$(az staticwebapp show --subscription "$SUBSCRIPTION_ID" \
        --resource-group "$RESOURCE_GROUP" --name "$SWA_NAME" --query defaultHostname -o tsv)"
    if [ "$ACTUAL_HOSTNAME" != "$SWA_HOSTNAME" ]; then
        echo "SWA hostname differs from saved state; inspect the target before deployment." >&2
        exit 1
    fi

    echo "Building production frontend for the saved target..."
    npm ci --include=dev --registry=https://registry.npmjs.org
    NODE_ENV=production npm run build -- --mode production
    if [ ! -d dist/assets ] || [ ! -f dist/index.html ]; then
        echo "Frontend build outputs are missing." >&2
        exit 1
    fi
    if grep -R "Loading from Vite environment variables (development)" dist/assets/ >/dev/null; then
        echo "Frontend bundle contains the development configuration path." >&2
        exit 1
    else
        GREP_STATUS=$?
        if [ "$GREP_STATUS" -ne 1 ]; then echo "Could not inspect frontend assets." >&2; exit 1; fi
    fi
    cp staticwebapp.config.json dist/staticwebapp.config.json

    node "$SCRIPT_DIR/configure-frontend.cjs" "$FRONTEND_DIR/dist"

    echo "Retrieving the deployment token without printing any portion..."
    SWA_TOKEN="$(az staticwebapp secrets list --subscription "$SUBSCRIPTION_ID" \
        --resource-group "$RESOURCE_GROUP" --name "$SWA_NAME" --query properties.apiKey -o tsv)"
    if [ -z "$SWA_TOKEN" ] || [ "$SWA_TOKEN" = null ]; then
        echo "SWA deployment token was not returned." >&2
        exit 1
    fi
    trap 'unset SWA_TOKEN' EXIT
    SWA_CLI_DEBUG=log SWA_CLI_DEPLOYMENT_TOKEN="$SWA_TOKEN" \
        swa deploy ./dist --env production --no-use-keychain --verbose log
    unset SWA_TOKEN

    echo "Deployment Complete!"
    echo "Frontend URL: https://$SWA_HOSTNAME"
    echo "Verify runtime config, redirect URIs, browser sign-in and the Linked Backend separately."
    exit 0
fi

ENV_SOURCE_FILE=""
if [ -f "$STATE_ENV_FILE" ]; then
    ENV_SOURCE_FILE="$STATE_ENV_FILE"
elif [ -f "$LOCAL_ENV_FILE" ]; then
    ENV_SOURCE_FILE="$LOCAL_ENV_FILE"
else
    echo -e "${RED}Error: Frontend configuration file not found.${NC}" >&2
    exit 1
fi

if grep -q $'\r' "$ENV_SOURCE_FILE"; then
    sed -i.bak $'s/\r$//' "$ENV_SOURCE_FILE"
    rm -f "$ENV_SOURCE_FILE.bak"
fi
# shellcheck source=/dev/null
source "$ENV_SOURCE_FILE"

GUID_PATTERN='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
for var_name in ENTRA_TENANT_ID ENTRA_FRONTEND_CLIENT_ID ENTRA_BACKEND_CLIENT_ID; do
    val="${!var_name:-}"
    if ! printf '%s' "$val" | grep -Eq "$GUID_PATTERN"; then
        echo -e "${RED}Error: $var_name is not configured in $ENV_SOURCE_FILE${NC}" >&2
        exit 1
    fi
done

FRONTEND_DIR="$(cd "$SCRIPT_DIR/../materials/frontend" && pwd)"
cd "$FRONTEND_DIR"

AZURE_ARGS=()
if [ -n "${SUBSCRIPTION_ID:-}" ]; then
    AZURE_ARGS+=(--subscription "$SUBSCRIPTION_ID")
fi
if [ -z "${SWA_NAME:-}" ]; then
    SWA_NAMES="$(az staticwebapp list "${AZURE_ARGS[@]}" \
        --resource-group "$RESOURCE_GROUP" --query "[].name" -o json)"
    SWA_NAME="$(node -e '
      const names = JSON.parse(process.argv[1]);
      if (!Array.isArray(names) || names.length !== 1 || typeof names[0] !== "string" || !names[0]) {
        console.error("Set SWA_NAME from the saved deployment outputs; exactly one SWA is required otherwise.");
        process.exit(1);
      }
      console.log(names[0]);
    ' "$SWA_NAMES")"
fi
SWA_HOSTNAME="$(az staticwebapp show "${AZURE_ARGS[@]}" \
    --resource-group "$RESOURCE_GROUP" --name "$SWA_NAME" \
    --query defaultHostname -o tsv)"

if [ -z "$SWA_HOSTNAME" ] || [ "$SWA_HOSTNAME" = null ]; then
    echo -e "${RED}Error: No Static Web App found in resource group $RESOURCE_GROUP${NC}" >&2
    exit 1
fi

SWA_TOKEN="$(az staticwebapp secrets list "${AZURE_ARGS[@]}" \
    --resource-group "$RESOURCE_GROUP" \
    --name "$SWA_NAME" --query "properties.apiKey" -o tsv)"

if [ -z "$SWA_TOKEN" ] || [ "$SWA_TOKEN" = null ]; then
    echo -e "${RED}Error: Could not get SWA deployment token${NC}" >&2
    exit 1
fi
echo "  Deployment token acquired; no portion will be displayed."

npm ci --include=dev --registry=https://registry.npmjs.org
NODE_ENV=production npm run build -- --mode production
if [ ! -d dist/assets ] || [ ! -f dist/index.html ]; then
    echo "Frontend build outputs are missing." >&2
    exit 1
fi
if grep -R "Loading from Vite environment variables (development)" dist/assets/ >/dev/null; then
    echo "Frontend bundle contains the development configuration path." >&2
    exit 1
else
    GREP_STATUS=$?
    if [ "$GREP_STATUS" -ne 1 ]; then echo "Could not inspect frontend assets." >&2; exit 1; fi
fi
cp staticwebapp.config.json dist/staticwebapp.config.json

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

SWA_CLI_DEBUG=log SWA_CLI_DEPLOYMENT_TOKEN="$SWA_TOKEN" \
    swa deploy ./dist --env production --no-use-keychain --verbose log
unset SWA_TOKEN

FRONTEND_URL="https://$SWA_HOSTNAME"
PUBLISHED_HTML="$(mktemp)"
trap 'unset SWA_TOKEN; rm -f "$PUBLISHED_HTML"' EXIT
FRONTEND_VERIFIED=false
for attempt in {1..12}; do
    if curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
        --output "$PUBLISHED_HTML" "$FRONTEND_URL/?workshop_deploy_check=$(date +%s)" \
        && cmp -s dist/index.html "$PUBLISHED_HTML"; then
        FRONTEND_VERIFIED=true
        break
    fi
    echo "Published frontend does not yet match this build (attempt $attempt/12)."
    if [ "$attempt" -lt 12 ]; then sleep 5; fi
done
if [ "$FRONTEND_VERIFIED" != true ]; then
    echo "Error: Published frontend does not match dist/index.html; deployment is not verified." >&2
    exit 1
fi
HEALTH_RESPONSE="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    "$FRONTEND_URL/api/health")"
node -e '
  const health = JSON.parse(process.argv[1]);
  if (health.status !== "healthy") {
    console.error("Error: SWA linked backend is not healthy.");
    process.exit(1);
  }
' "$HEALTH_RESPONSE"

echo "Deployment Complete!"
echo "Frontend URL: https://$SWA_HOSTNAME"
echo "Verify runtime config, redirect URIs, browser sign-in and the Linked Backend separately."
