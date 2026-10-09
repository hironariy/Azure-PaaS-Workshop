#!/bin/bash
# Usage: ./scripts/deploy-backend.sh <saved-resource-group> <saved-app-service-name>

set +x
set -euo pipefail

RESOURCE_GROUP="${1:-}"
APP_SERVICE_NAME="${2:-}"
if [ -z "$RESOURCE_GROUP" ] || [ -z "$APP_SERVICE_NAME" ] || [ "$#" -ne 2 ]; then
    echo "Usage: $0 <saved-resource-group> <saved-app-service-name>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/workshop-deploy-common.sh"
workshop_deploy_load_target "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
BACKEND_DIR="$WORKSHOP_REPO_DIR/materials/backend"
cd "$BACKEND_DIR"

HOSTNAME="$(az webapp show --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --query defaultHostName -o tsv)"
if ! [[ "$HOSTNAME" =~ ^[a-z0-9.-]+\.azurewebsites\.net$ ]]; then
    echo "App Service did not return an expected public hostname." >&2
    exit 1
fi

ARTIFACT_DIR="$(mktemp -d "$BACKEND_DIR/.deploy-XXXXXX")"
cleanup_artifacts() {
    local status=$?
    trap - EXIT
    case "$ARTIFACT_DIR" in
        "$BACKEND_DIR"/.deploy-??????)
            if ! rm -rf -- "$ARTIFACT_DIR"; then
                echo "Failed to remove owned deployment artifacts: $ARTIFACT_DIR" >&2
                exit 1
            fi ;;
        *) echo "Refusing unsafe artifact cleanup." >&2; exit 1 ;;
    esac
    exit "$status"
}
trap cleanup_artifacts EXIT
PACKAGE_DIR="$ARTIFACT_DIR/package"
DEPLOY_ZIP="$ARTIFACT_DIR/deploy.zip"
mkdir "$PACKAGE_DIR"

echo "Building backend and creating an isolated production package..."
npm ci
npm run build -- --outDir "$PACKAGE_DIR/dist"
cp package.json package-lock.json "$PACKAGE_DIR/"
cd "$PACKAGE_DIR"
npm ci --omit=dev
if [ ! -f dist/src/app.js ]; then
    echo "Build did not produce the required dist/src/app.js." >&2
    exit 1
fi

if command -v zip >/dev/null 2>&1; then
    zip -qr "$DEPLOY_ZIP" .
else
    ZIP_TOOL=""
    for candidate in 7z 7za 7zz 7z.exe; do
        if command -v "$candidate" >/dev/null 2>&1; then ZIP_TOOL="$candidate"; break; fi
    done
    if [ -z "$ZIP_TOOL" ]; then echo "Install zip or 7-Zip before deployment." >&2; exit 1; fi
    "$ZIP_TOOL" a -tzip "$DEPLOY_ZIP" ./* >/dev/null
fi
if command -v unzip >/dev/null 2>&1; then
    unzip -t "$DEPLOY_ZIP" >/dev/null
    ZIP_ENTRIES="$(unzip -Z1 "$DEPLOY_ZIP")"
    if printf '%s\n' "$ZIP_ENTRIES" | grep -F '\'; then
        echo "ZIP contains unsupported Windows-style path separators." >&2
        exit 1
    fi
    if ! grep -qx 'dist/src/app.js' <<< "$ZIP_ENTRIES"; then
        echo "ZIP is missing the startup file." >&2
        exit 1
    fi
fi

echo "Configuring the saved App Service target..."
az webapp config appsettings set --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
    --settings "SCM_DO_BUILD_DURING_DEPLOYMENT=false" --output none
az webapp config set --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
    --startup-file "node dist/src/app.js" --output none

DEPLOY_HELP="$(az webapp deploy --help)"
set --
if [[ "$DEPLOY_HELP" == *"--track-status"* ]]; then set -- --track-status false; fi
echo "Uploading ZIP asynchronously; upload acceptance is not deployment completion."
az webapp deploy --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
    --src-path "$DEPLOY_ZIP" --type zip --clean true --restart true \
    --async true "$@"

echo "Waiting 20s before bounded readiness checks..."
sleep 20
if ! workshop_wait_for_health "https://$HOSTNAME/health"; then
    echo "Inspect deployment status, startup, Managed Identity/Key Vault references and DB connectivity." >&2
    echo "Do not publish app settings, connection strings, tokens or unsanitized logs." >&2
    exit 1
fi
echo "Upload and readiness checks passed: https://$HOSTNAME"
echo "Separately verify this deployment's completion and new application content; old-instance health is not release proof."
