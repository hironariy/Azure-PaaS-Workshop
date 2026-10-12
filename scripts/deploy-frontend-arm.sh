#!/bin/bash
# Usage: bash scripts/deploy-frontend-arm.sh <saved-resource-group> <prepare|deploy> <zip-path>

set +x
set -euo pipefail
umask 077
unset SWA_TOKEN SWA_CLI_DEPLOYMENT_TOKEN

if [ "$#" -ne 3 ] || { [ "$2" != prepare ] && [ "$2" != deploy ]; }; then
    echo "Usage: $0 <saved-resource-group> <prepare|deploy> <zip-path>" >&2
    exit 1
fi
EXPECTED_GROUP="$1"
MODE="$2"
ARCHIVE="$(node -e 'console.log(require("node:path").resolve(process.argv[1]))' "$3")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/workshop-deploy-common.sh"
workshop_deploy_load_target "$EXPECTED_GROUP"

if [ "$MODE" = prepare ]; then
    if [ -e "$ARCHIVE" ] || [ -L "$ARCHIVE" ] || [ -e "$ARCHIVE.json" ] || [ -L "$ARCHIVE.json" ]; then
        echo "Use a new ZIP path; existing files will not be overwritten." >&2
        exit 1
    fi
    export ENTRA_TENANT_ID="$TENANT_ID"
    export ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
    export ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
    cd "$WORKSHOP_REPO_DIR/materials/frontend"
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
        STATUS=$?
        if [ "$STATUS" -ne 1 ]; then echo "Could not inspect frontend assets." >&2; exit 1; fi
    fi
    cp staticwebapp.config.json dist/staticwebapp.config.json
    node "$SCRIPT_DIR/configure-frontend.cjs" "$PWD/dist"
    node "$SCRIPT_DIR/deploy-swa-arm.cjs" prepare "$WORKSHOP_STATE_DIR" "$PWD/dist" "$ARCHIVE"
else
    echo "Use only an approved, owned HTTPS host for the prepared ZIP. No Storage will be created."
    echo "Enter its temporary read-only URL (hidden; never put it in a command argument):" >&2
    IFS= read -r -s ARTIFACT_URL || { echo "Artifact URL input failed." >&2; exit 1; }
    printf '\n' >&2
    printf '%s' "$ARTIFACT_URL" | node "$SCRIPT_DIR/deploy-swa-arm.cjs" deploy "$WORKSHOP_STATE_DIR" "$ARCHIVE"
    unset ARTIFACT_URL
fi
