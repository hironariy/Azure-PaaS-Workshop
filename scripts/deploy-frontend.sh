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

node <<'NODE'
const fs = require('node:fs');
const indexPath = 'dist/index.html';
const config = {
  ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID,
  ENTRA_FRONTEND_CLIENT_ID: process.env.ENTRA_FRONTEND_CLIENT_ID,
  ENTRA_BACKEND_CLIENT_ID: process.env.ENTRA_BACKEND_CLIENT_ID,
  API_BASE_URL: '/api',
};
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
for (const [key, value] of Object.entries(config)) {
  if (key !== 'API_BASE_URL' && !guid.test(value || '')) throw new Error(`Invalid public config: ${key}`);
}
const assignment = `window.__APP_CONFIG__=${JSON.stringify(config)};`;
const pattern = /window\.__APP_CONFIG__\s*=\s*(?:null|undefined|\{[^<]*?\}|)\s*;/;
const html = fs.readFileSync(indexPath, 'utf8');
if (!pattern.test(html)) throw new Error('Missing window.__APP_CONFIG__ placeholder.');
const updated = html.replace(pattern, assignment);
fs.writeFileSync(indexPath, updated);
if (!fs.readFileSync(indexPath, 'utf8').includes(assignment)) throw new Error('Runtime config verification failed.');
NODE

echo "Retrieving the deployment token without printing any portion..."
SWA_TOKEN="$(az staticwebapp secrets list --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$SWA_NAME" --query properties.apiKey -o tsv)"
if [ -z "$SWA_TOKEN" ] || [ "$SWA_TOKEN" = null ]; then
    echo "SWA deployment token was not returned." >&2
    exit 1
fi
trap 'unset SWA_TOKEN' EXIT
SWA_CLI_DEPLOYMENT_TOKEN="$SWA_TOKEN" swa deploy ./dist --env production
unset SWA_TOKEN

echo "Deployment Complete!"
echo "Frontend URL: https://$SWA_HOSTNAME"
echo "Verify runtime config, redirect URIs, browser sign-in and the Linked Backend separately."
