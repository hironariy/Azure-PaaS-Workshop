#!/bin/bash
# Usage: ./scripts/deploy-frontend.sh <saved-resource-group>

set +x
set -euo pipefail
unset SWA_CLI_DEPLOYMENT_TOKEN SWA_TOKEN

RESOURCE_GROUP="${1:-}"
if [ -z "$RESOURCE_GROUP" ] || [ "$#" -ne 1 ]; then
    echo "Usage: $0 <saved-resource-group>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
SWA_CLI_DEBUG=log SWA_CLI_DEPLOYMENT_TOKEN="$SWA_TOKEN" swa deploy ./dist --env production --verbose log
unset SWA_TOKEN

echo "Deployment Complete!"
echo "Frontend URL: https://$SWA_HOSTNAME"
echo "Verify runtime config, redirect URIs, browser sign-in and the Linked Backend separately."
