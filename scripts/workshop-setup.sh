#!/bin/bash
#
# Azure PaaS Workshop Setup Script
# 
# This script configures Azure resources and GitHub secrets for the workshop.
# Run this after creating your repository from the template.
#
# Prerequisites:
#   - Azure CLI (az) installed and logged in
#   - GitHub CLI (gh) installed and authenticated (optional, for auto-configuring secrets)
#
# Usage:
#   chmod +x scripts/workshop-setup.sh
#   ./scripts/workshop-setup.sh
#

set +x
set -euo pipefail
GITHUB_USER="${GITHUB_USER:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║           Azure PaaS Workshop Setup Script                 ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Azure CLI
    if ! command -v az >/dev/null 2>&1; then
        print_error "Azure CLI is required but not installed."
        echo "  Install: https://docs.microsoft.com/cli/azure/install-azure-cli"
        exit 1
    fi
    print_success "Azure CLI found"
    
    # Check Azure login status
    if ! az account show --output none; then
        print_error "Unable to read Azure context. Resolve the CLI error before continuing."
        exit 1
    fi
    print_success "Azure CLI logged in"
    command -v node >/dev/null
    command -v jq >/dev/null
    
    # Check GitHub CLI (optional)
    if command -v gh >/dev/null 2>&1; then
        if gh auth status >/dev/null 2>&1; then
            print_success "GitHub CLI found and authenticated"
            GH_AVAILABLE=true
        else
            print_warning "GitHub CLI found but not authenticated. Secrets will need manual configuration."
            GH_AVAILABLE=false
        fi
    else
        print_warning "GitHub CLI not found. Secrets will need manual configuration."
        echo "  Install: https://cli.github.com/"
        GH_AVAILABLE=false
    fi
    
    # Check git repository
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        print_error "Not inside a git repository."
        echo "  Run this script from your cloned repository root."
        exit 1
    fi
    print_success "Git repository detected"
}

# Get configuration
get_configuration() {
    print_step "Gathering configuration..."
    
    # Get GitHub username
    if [ "$GH_AVAILABLE" = true ]; then
        GITHUB_REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
        GITHUB_USER="${GITHUB_REPO%/*}"
    fi
    
    if [ -z "$GITHUB_USER" ]; then
        read -p "  Enter your GitHub username: " GITHUB_USER
    fi
    
    # Get repository name from git remote
    REPO_URL=$(git remote get-url origin)
    if [ -n "$REPO_URL" ]; then
        REPO_NAME=$(basename "$REPO_URL" .git)
    else
        REPO_NAME="Azure-PaaS-Workshop"
    fi
    if [ "$GH_AVAILABLE" = true ]; then REPO_NAME="${GITHUB_REPO##*/}"; fi
    if ! [[ "$GITHUB_USER" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}$ &&
            "$REPO_NAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
        print_error "Invalid GitHub repository owner/name."
        exit 1
    fi
    
    # Azure configuration
    LOCATION="${AZURE_LOCATION:-japanwest}"
    RESOURCE_GROUP="rg-paasworkshop-${GITHUB_USER}"
    APP_NAME="gha-${GITHUB_USER}-paasworkshop"
    
    # Truncate app name if too long (max 120 chars for display name)
    if [ ${#APP_NAME} -gt 50 ]; then
        APP_NAME=$(echo "$APP_NAME" | cut -c1-50)
    fi
    
    echo ""
    echo -e "  ${YELLOW}Configuration Summary:${NC}"
    echo "  ─────────────────────────────────────────"
    echo "  GitHub User:    $GITHUB_USER"
    echo "  Repository:     $REPO_NAME"
    echo "  Resource Group: $RESOURCE_GROUP"
    echo "  Location:       $LOCATION"
    echo "  App Name:       $APP_NAME"
    echo ""
    
    read -p "  Proceed with this configuration? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
}

# Create Azure resources
create_azure_resources() {
    print_step "Creating Azure resources..."
    
    # Get subscription and tenant info
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    TENANT_ID=$(az account show --query tenantId -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    
    echo "  Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
    node "$SCRIPT_DIR/check-role-assignment-permission.cjs" "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP"
    
    # Create Resource Group
    echo "  Creating resource group..."
    az group create \
        --subscription "$SUBSCRIPTION_ID" \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    print_success "Resource group created: $RESOURCE_GROUP"
    
    # Check if App Registration already exists
    EXISTING_APPS="$(az ad app list --display-name "$APP_NAME" --query '[].appId' -o json)"
    APP_COUNT="$(printf '%s' "$EXISTING_APPS" | jq -er 'if type=="array" then length else error("Expected app array") end')"
    if [ "$APP_COUNT" -gt 1 ]; then print_error "Multiple matching applications; resolve ambiguity."; exit 1; fi
    EXISTING_APP="$(printf '%s' "$EXISTING_APPS" | jq -r '.[0] // empty')"
    
    if [ -n "$EXISTING_APP" ]; then
        print_warning "App Registration '$APP_NAME' already exists. Using existing app."
        APP_ID="$EXISTING_APP"
    else
        # Create App Registration for GitHub Actions
        echo "  Creating App Registration..."
        APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
        print_success "App Registration created: $APP_ID"
    fi
    
    # Create Service Principal if not exists
    SIGNED_IN_USER_ID="$(az ad signed-in-user show --query id -o tsv)"
    APP_OWNERS="$(az ad app owner list --id "$APP_ID" -o json)"
    printf '%s' "$APP_OWNERS" | jq -e --arg user "$SIGNED_IN_USER_ID" 'any(.[]; .id == $user)' >/dev/null
    EXISTING_SPS="$(az ad sp list --filter "appId eq '$APP_ID'" --query '[].id' -o json)"
    SP_COUNT="$(printf '%s' "$EXISTING_SPS" | jq -er 'if type=="array" then length else error("Expected SP array") end')"
    if [ "$SP_COUNT" -gt 1 ]; then print_error "Multiple matching service principals."; exit 1; fi
    SP_ID="$(printf '%s' "$EXISTING_SPS" | jq -r '.[0] // empty')"
    
    if [ -z "$SP_ID" ]; then
        echo "  Creating Service Principal..."
        SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
        print_success "Service Principal created"
        
        # Wait for propagation
        echo "  Waiting for Azure AD propagation..."
        sleep 10
    else
        print_success "Service Principal already exists"
    fi
    
    # Assign Contributor role on resource group
    echo "  Assigning Contributor role..."
    az role assignment create \
        --subscription "$SUBSCRIPTION_ID" \
        --assignee-object-id "$SP_ID" \
        --assignee-principal-type ServicePrincipal \
        --role "Contributor" \
        --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
        --output none
    print_success "Contributor role assigned on $RESOURCE_GROUP"
    
    # Create Federated Credential for GitHub Actions
    FED_CRED_NAME="github-${GITHUB_USER}-main"
    SUBJECT="repo:${GITHUB_USER}/${REPO_NAME}:ref:refs/heads/main"
    
    # Check if federated credential already exists
    EXISTING_CREDS="$(az ad app federated-credential list --id "$APP_ID" \
        --query "[?name=='$FED_CRED_NAME']" -o json)"
    CRED_COUNT="$(printf '%s' "$EXISTING_CREDS" | jq -er 'if type=="array" then length else error("Expected credential array") end')"
    if [ "$CRED_COUNT" -gt 1 ]; then print_error "Multiple matching federated credentials."; exit 1; fi
    EXISTING_CRED="$(printf '%s' "$EXISTING_CREDS" | jq -r '.[0].name // empty')"
    
    if [ -n "$EXISTING_CRED" ]; then
        printf '%s' "$EXISTING_CREDS" | jq -e --arg subject "$SUBJECT" \
            '.[0] | .subject == $subject and .issuer == "https://token.actions.githubusercontent.com" and .audiences == ["api://AzureADTokenExchange"]' >/dev/null
        print_success "Existing federated credential matches the requested repository and branch."
    else
        echo "  Creating Federated Credential..."
        az ad app federated-credential create \
            --id "$APP_ID" \
            --parameters "{
                \"name\": \"$FED_CRED_NAME\",
                \"issuer\": \"https://token.actions.githubusercontent.com\",
                \"subject\": \"$SUBJECT\",
                \"audiences\": [\"api://AzureADTokenExchange\"]
            }" \
            --output none
        print_success "Federated credential created for: $SUBJECT"
    fi
}

# Configure public GitHub variables for OIDC.
configure_github_secrets() {
    print_step "Configuring GitHub OIDC variables..."
    
    if [ "$GH_AVAILABLE" = true ]; then
        echo "  Setting public GitHub variables automatically..."
        
        if gh variable set AZURE_CLIENT_ID --repo "$GITHUB_USER/$REPO_NAME" --body "$APP_ID"; then
            print_success "AZURE_CLIENT_ID set"
        else
            print_error "Failed to set AZURE_CLIENT_ID"
            exit 1
        fi
        
        if gh variable set AZURE_TENANT_ID --repo "$GITHUB_USER/$REPO_NAME" --body "$TENANT_ID"; then
            print_success "AZURE_TENANT_ID set"
        else
            print_error "Failed to set AZURE_TENANT_ID"
            exit 1
        fi
        
        if gh variable set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_USER/$REPO_NAME" --body "$SUBSCRIPTION_ID"; then
            print_success "AZURE_SUBSCRIPTION_ID set"
        else
            print_error "Failed to set AZURE_SUBSCRIPTION_ID"
            exit 1
        fi
    else
        echo ""
        echo -e "  ${YELLOW}Manual Configuration Required${NC}"
        echo "  ─────────────────────────────────────────"
        echo "  Go to: https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/secrets/actions"
        echo ""
        echo "  Add these Variables (not client secrets):"
        echo ""
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║             Azure identity setup completed                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}GitHub OIDC Variables (configure if not auto-set):${NC}"
    echo "─────────────────────────────────────────────────────────────"
    echo -e "  ${GREEN}AZURE_CLIENT_ID${NC}:       $APP_ID"
    echo -e "  ${GREEN}AZURE_TENANT_ID${NC}:       $TENANT_ID"
    echo -e "  ${GREEN}AZURE_SUBSCRIPTION_ID${NC}: $SUBSCRIPTION_ID"
    echo ""
    echo -e "${YELLOW}GitHub Variables / Secrets URL:${NC}"
    echo "  https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/secrets/actions"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "─────────────────────────────────────────────────────────────"
    echo "  1. Verify GitHub OIDC Variables and deployment target Variables are configured"
    echo "     Manual variable configuration is still required if GitHub CLI was unavailable."
    echo "     A Contributor service principal cannot create the Bicep Key Vault role assignments."
    echo ""
    echo "  2. Deploy infrastructure:"
    echo "     cd materials/bicep"
    echo "     az deployment group create \\"
    echo "       --resource-group $RESOURCE_GROUP \\"
    echo "       --template-file main.bicep \\"
    echo "       --parameters main.bicepparam"
    echo ""
    echo "  3. Trigger GitHub Actions deployment:"
    echo "     git commit --allow-empty -m 'Trigger deployment'"
    echo "     git push"
    echo ""
    echo -e "${YELLOW}Cleanup After Workshop:${NC}"
    echo "─────────────────────────────────────────────────────────────"
    echo "  Follow materials/docs/learner/cleanup.ja.md; verify the dedicated target and ownership."
    echo "  This optional GitHub identity is separate from the learner backend/frontend apps."
    echo ""
    
    # Save configuration to file for reference
    CONFIG_FILE=".workshop-config"
    cat > "$CONFIG_FILE" << EOF
# Workshop Configuration (generated by setup script)
# DO NOT COMMIT THIS FILE

GITHUB_USER=$GITHUB_USER
REPO_NAME=$REPO_NAME
RESOURCE_GROUP=$RESOURCE_GROUP
LOCATION=$LOCATION
APP_ID=$APP_ID
TENANT_ID=$TENANT_ID
SUBSCRIPTION_ID=$SUBSCRIPTION_ID
EOF
    
    print_success "Configuration saved to $CONFIG_FILE"
    
    # Add to .gitignore if not already there
    if ! grep -q "^\.workshop-config$" .gitignore 2>/dev/null; then
        echo ".workshop-config" >> .gitignore
        print_success "Added .workshop-config to .gitignore"
    fi
}

# Main execution
main() {
    print_banner
    check_prerequisites
    get_configuration
    create_azure_resources
    configure_github_secrets
    print_summary
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
