#!/bin/bash

if [ -n "${BASH_SOURCE[0]:-}" ]; then
    _workshop_state_source="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then
    eval '_workshop_state_source="${(%):-%x}"'
else
    _workshop_state_source="$0"
fi
WORKSHOP_STATE_SCRIPT_DIR="$(cd -- "$(dirname -- "$_workshop_state_source")" && pwd)"
unset _workshop_state_source

export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$(cd -- "$WORKSHOP_STATE_SCRIPT_DIR/.." && pwd)}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
export ENV_FILE="${ENV_FILE:-$WORKSHOP_STATE_DIR/paas-workshop.json}"

workshop_state_check_context() {
    local account
    account="$(az account show --query '{id:id,tenantId:tenantId,state:state}' -o json)" || return 1
    ACCOUNT_JSON="$account" node -e '
      const account = JSON.parse(process.env.ACCOUNT_JSON);
      if (account.id?.toLowerCase() !== process.env.SUBSCRIPTION_ID?.toLowerCase() ||
          account.tenantId?.toLowerCase() !== process.env.TENANT_ID?.toLowerCase() ||
          account.state !== "Enabled") {
        console.error("Azure context mismatch. Select the saved subscription/tenant explicitly, then retry.");
        process.exit(1);
      }
    ' || return 1
}

workshop_state_init() {
    local helper
    helper="${WORKSHOP_STATE_SCRIPT_DIR}/workshop-state.cjs"
    workshop_state_check_context || return 1
    node "$helper" init "${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}" base
}

workshop_state_save() {
    local helper
    helper="${WORKSHOP_STATE_SCRIPT_DIR}/workshop-state.cjs"
    workshop_state_check_context || return 1
    node "$helper" save "${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}" "${1:-base}"
}

workshop_state_load() {
    local helper records key value
    helper="${WORKSHOP_STATE_SCRIPT_DIR}/workshop-state.cjs"
    records="$(mktemp)" || return 1
    if ! node "$helper" load "${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}" "${1:-base}" > "$records"; then
        rm -f "$records"
        return 1
    fi
    while IFS= read -r -d '' key && IFS= read -r -d '' value; do
        export "$key=$value"
    done < "$records"
    rm -f "$records"
    workshop_state_check_context || return 1
    cd "$WORKSHOP_REPO_DIR" || return 1
}
