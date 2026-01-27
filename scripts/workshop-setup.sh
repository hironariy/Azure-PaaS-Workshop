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

set -e

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
    if ! az account show >/dev/null 2>&1; then
        print_error "Not logged in to Azure CLI."
        echo "  Run: az login"
        exit 1
    fi
    print_success "Azure CLI logged in"
    
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
        GITHUB_USER=$(gh api user --jq '.login' 2>/dev/null || echo "")
    fi
    
    if [ -z "$GITHUB_USER" ]; then
        read -p "  Enter your GitHub username: " GITHUB_USER
    fi
    
    # Get repository name from git remote
    REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -n "$REPO_URL" ]; then
        REPO_NAME=$(basename "$REPO_URL" .git)
    else
        REPO_NAME="Azure-PaaS-Workshop"
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
    
    # Create Resource Group
    echo "  Creating resource group..."
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    print_success "Resource group created: $RESOURCE_GROUP"
    
    # Check if App Registration already exists
    EXISTING_APP=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")
    
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
    SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || echo "")
    
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
        --assignee-object-id "$SP_ID" \
        --assignee-principal-type ServicePrincipal \
        --role "Contributor" \
        --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
        --output none 2>/dev/null || true
    print_success "Contributor role assigned on $RESOURCE_GROUP"
    
    # Create Federated Credential for GitHub Actions
    FED_CRED_NAME="github-${GITHUB_USER}-main"
    SUBJECT="repo:${GITHUB_USER}/${REPO_NAME}:ref:refs/heads/main"
    
    # Check if federated credential already exists
    EXISTING_CRED=$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$FED_CRED_NAME'].name" -o tsv 2>/dev/null || echo "")
    
    if [ -n "$EXISTING_CRED" ]; then
        print_warning "Federated credential already exists. Skipping creation."
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

# Configure GitHub secrets
configure_github_secrets() {
    print_step "Configuring GitHub secrets..."
    
    if [ "$GH_AVAILABLE" = true ]; then
        echo "  Setting GitHub secrets automatically..."
        
        if gh secret set AZURE_CLIENT_ID --body "$APP_ID" 2>/dev/null; then
            print_success "AZURE_CLIENT_ID set"
        else
            print_error "Failed to set AZURE_CLIENT_ID"
        fi
        
        if gh secret set AZURE_TENANT_ID --body "$TENANT_ID" 2>/dev/null; then
            print_success "AZURE_TENANT_ID set"
        else
            print_error "Failed to set AZURE_TENANT_ID"
        fi
        
        if gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID" 2>/dev/null; then
            print_success "AZURE_SUBSCRIPTION_ID set"
        else
            print_error "Failed to set AZURE_SUBSCRIPTION_ID"
        fi
    else
        echo ""
        echo -e "  ${YELLOW}Manual Configuration Required${NC}"
        echo "  ─────────────────────────────────────────"
        echo "  Go to: https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/secrets/actions"
        echo ""
        echo "  Add these secrets:"
        echo ""
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    Setup Complete!                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}GitHub Secrets (configure if not auto-set):${NC}"
    echo "─────────────────────────────────────────────────────────────"
    echo -e "  ${GREEN}AZURE_CLIENT_ID${NC}:       $APP_ID"
    echo -e "  ${GREEN}AZURE_TENANT_ID${NC}:       $TENANT_ID"
    echo -e "  ${GREEN}AZURE_SUBSCRIPTION_ID${NC}: $SUBSCRIPTION_ID"
    echo ""
    echo -e "${YELLOW}GitHub Secrets URL:${NC}"
    echo "  https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/secrets/actions"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "─────────────────────────────────────────────────────────────"
    echo "  1. Verify GitHub secrets are configured"
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
    echo "  # Delete all Azure resources"
    echo "  az group delete --name $RESOURCE_GROUP --yes --no-wait"
    echo ""
    echo "  # Delete App Registration"
    echo "  az ad app delete --id $APP_ID"
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

main "$@"
