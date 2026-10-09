#!/bin/bash
# Deletes only the saved dedicated Azure targets after explicit confirmation.

set +x
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/workshop-state.sh"
workshop_state_load base

GROUP_EXISTS="$(az group exists --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP")"
case "$GROUP_EXISTS" in true|false) ;; *) echo "Invalid group lookup result." >&2; exit 1 ;; esac
if [ "$GROUP_EXISTS" = true ]; then
    TAGS="$(az group show --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP" --query tags -o json)"
    printf '%s' "$TAGS" | jq -e --arg group "$GROUP_ID" \
        '.Workshop == "Azure-PaaS-Workshop" and .GroupId == $group' >/dev/null || {
        echo "Workshop/group ownership tags do not match; refusing group deletion." >&2
        exit 1
    }
    az resource list --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" \
        --query '[].{name:name,type:type}' -o table
fi

DELETE_APPS=""
for client_id in "${FRONTEND_CLIENT_ID:-}" "${BACKEND_CLIENT_ID:-}"; do
    [ -n "$client_id" ] || continue
    APPS="$(az ad app list --filter "appId eq '$client_id'" --query '[].appId' -o json)"
    COUNT="$(printf '%s' "$APPS" | jq -er 'if type=="array" then length else error("Expected application array") end')"
    if [ "$COUNT" = 0 ]; then printf 'Application already absent: %s\n' "$client_id"; continue; fi
    if [ "$COUNT" != 1 ]; then echo "Ambiguous application lookup; refusing deletion." >&2; exit 1; fi
    USER_ID="$(az ad signed-in-user show --query id -o tsv)"
    OWNERS="$(az ad app owner list --id "$client_id" -o json)"
    printf '%s' "$OWNERS" | jq -e --arg user "$USER_ID" 'any(.[]; .id == $user)' >/dev/null || {
        echo "Application is not owned by the signed-in user; refusing deletion." >&2
        exit 1
    }
    printf 'Owned application scheduled for deletion: %s\n' "$client_id"
    DELETE_APPS="$DELETE_APPS $client_id"
done

TARGET="$SUBSCRIPTION_ID/$RESOURCE_GROUP"
printf 'Target: %s\nOnly proceed if this entire RG and these apps are dedicated to your group and not shared.\n' "$TARGET"
read -r -p "Type the complete target to confirm deletion: " CONFIRM
if [ "$CONFIRM" != "$TARGET" ]; then echo "Deletion cancelled; confirmation did not match." >&2; exit 1; fi
workshop_state_check_context

if [ "$GROUP_EXISTS" = true ]; then
    az group delete --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP" --yes --no-wait
    az group wait --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP" \
        --deleted --interval 15 --timeout 900
fi
REMAINING="$(az group exists --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP")"
if [ "$REMAINING" != false ]; then echo "Group deletion is not confirmed; retaining apps and state." >&2; exit 1; fi

for client_id in $DELETE_APPS; do
    az ad app delete --id "$client_id"
    APPS="$(az ad app list --filter "appId eq '$client_id'" --query '[].appId' -o json)"
    printf '%s' "$APPS" | jq -e 'type == "array" and length == 0' >/dev/null || {
        echo "Application deletion is not confirmed; retaining local state." >&2
        exit 1
    }
done
echo "Saved Azure targets are confirmed absent. Local checkout, state and parameter file were retained."
