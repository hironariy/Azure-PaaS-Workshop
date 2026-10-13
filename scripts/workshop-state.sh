#!/bin/bash

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
    helper="${BASH_SOURCE[0]%/*}/workshop-state.cjs"
    workshop_state_check_context || return 1
    node "$helper" init "${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}" base
}

workshop_state_save() {
    local helper
    helper="${BASH_SOURCE[0]%/*}/workshop-state.cjs"
    workshop_state_check_context || return 1
    node "$helper" save "${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}" "${1:-base}"
}

workshop_state_load() {
    local helper records key value
    helper="${BASH_SOURCE[0]%/*}/workshop-state.cjs"
    records="$(mktemp)" || return 1
    if ! node "$helper" load "${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}" "${1:-base}" > "$records"; then
        rm -f "$records"
        return 1
    fi
    while IFS= read -r -d '' key && IFS= read -r -d '' value; do
        printf -v "$key" '%s' "$value"
        export "$key"
    done < "$records"
    rm -f "$records"
    workshop_state_check_context || return 1
    cd "$WORKSHOP_REPO_DIR" || return 1
}
