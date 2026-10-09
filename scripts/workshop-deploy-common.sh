#!/bin/bash

workshop_deploy_load_target() {
    local expected_group="$1" expected_app="${2:-}"
    source "${BASH_SOURCE[0]%/*}/workshop-state.sh" || return 1
    workshop_state_load deployed || return 1
    if [ "$RESOURCE_GROUP" != "$expected_group" ] ||
       { [ -n "$expected_app" ] && [ "$APP_SERVICE_NAME" != "$expected_app" ]; }; then
        echo "Deployment target differs from saved state; no deployment was performed." >&2
        return 1
    fi
}

workshop_wait_for_health() {
    local url="$1" attempts="${2:-30}" interval="${3:-15}"
    local response code attempt started=$SECONDS
    if ! [[ "$attempts" =~ ^[1-9][0-9]{0,2}$ && "$interval" =~ ^[0-9]{1,2}$ ]]; then
        echo "Invalid health retry limits." >&2
        return 1
    fi
    response="$(mktemp "${TMPDIR:-/tmp}/paas-health.XXXXXX")" || return 1
    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if code="$(curl --silent --show-error --connect-timeout 5 --max-time 10 \
            --output "$response" --write-out '%{http_code}' "$url")"; then
            if [ "$code" = 200 ] && node - "$response" <<'NODE'
const fs = require('node:fs');
const text = fs.readFileSync(process.argv[2], 'utf8');
let body;
try {
  body = JSON.parse(text);
} catch {
  console.error('Health endpoint did not return valid JSON.');
  process.exit(1);
}
if (!body || body.status !== 'healthy') {
  console.error('Health JSON did not report status=healthy.');
  process.exit(1);
}
NODE
            then
                rm -f -- "$response" || return 1
                printf 'Readiness passed after %ss (HTTP 200, status=healthy).\n' "$((SECONDS - started))"
                return 0
            fi
            printf 'Readiness attempt %s/%s: HTTP %s; not ready.\n' "$attempt" "$attempts" "$code" >&2
        else
            printf 'Readiness attempt %s/%s: transport failure; not ready.\n' "$attempt" "$attempts" >&2
        fi
        if [ "$attempt" -lt "$attempts" ]; then sleep "$interval" || { rm -f -- "$response"; return 1; }; fi
    done
    rm -f -- "$response" || return 1
    printf 'Readiness failed after %ss and %s attempts.\n' "$((SECONDS - started))" "$attempts" >&2
    return 1
}
