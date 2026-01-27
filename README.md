# Azure PaaS Workshop

[![Deploy Infrastructure](https://github.com/hironariy/Azure-PaaS-Workshop/actions/workflows/infrastructure-deploy.yml/badge.svg)](https://github.com/hironariy/Azure-PaaS-Workshop/actions/workflows/infrastructure-deploy.yml)
[![Deploy Backend](https://github.com/hironariy/Azure-PaaS-Workshop/actions/workflows/backend-deploy.yml/badge.svg)](https://github.com/hironariy/Azure-PaaS-Workshop/actions/workflows/backend-deploy.yml)
[![Deploy Frontend](https://github.com/hironariy/Azure-PaaS-Workshop/actions/workflows/azure-static-web-apps.yml/badge.svg)](https://github.com/hironariy/Azure-PaaS-Workshop/actions/workflows/azure-static-web-apps.yml)

> 🎓 **Workshop Repository** - Click "Use this template" to create your own copy!

Learn Azure PaaS services by deploying a full-stack blog application with:
- **Azure Static Web Apps** - React frontend with global distribution
- **Azure App Service** - Node.js Express API backend
- **Azure Cosmos DB for MongoDB vCore** - Managed database
- **Azure Application Gateway + WAF** - Web Application Firewall protection
- **GitHub Actions** - CI/CD pipeline with OIDC authentication

## 📋 Prerequisites

Before starting the workshop, ensure you have:

- [ ] **GitHub account** - [Sign up free](https://github.com/join)
- [ ] **Azure subscription** - [Free trial](https://azure.microsoft.com/free/) or MSDN subscription
- [ ] **Azure CLI** - [Install guide](https://docs.microsoft.com/cli/azure/install-azure-cli)
- [ ] **GitHub CLI** (recommended) - [Install guide](https://cli.github.com/)
- [ ] **Node.js 20 LTS** - [Download](https://nodejs.org/)
- [ ] **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

## 🚀 Getting Started

### Step 1: Create Your Repository

Click the green **"Use this template"** button at the top of this page, then select **"Create a new repository"**.

| Setting | Recommendation |
|---------|----------------|
| **Owner** | Your GitHub username |
| **Repository name** | `Azure-PaaS-Workshop` (or any name) |
| **Visibility** | Public (required for free GitHub Actions) |
| **Include all branches** | ☐ Unchecked |

### Step 2: Clone Your Repository

```bash
git clone https://github.com/<your-username>/Azure-PaaS-Workshop.git
cd Azure-PaaS-Workshop
```

### Step 3: Run Setup Script

The setup script will:
- Create an Azure resource group
- Create an App Registration with Federated Credential for GitHub Actions
- Configure GitHub secrets (if GitHub CLI is installed)

```bash
# Login to Azure
az login

# Make script executable and run
chmod +x scripts/workshop-setup.sh
./scripts/workshop-setup.sh
```

### Step 4: Verify GitHub Secrets

After running the setup script, verify these secrets are configured:

Go to your repository → **Settings** → **Secrets and variables** → **Actions**

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | App Registration client ID |
| `AZURE_TENANT_ID` | Microsoft Entra ID tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |

### Step 5: Deploy Infrastructure

```bash
cd materials/bicep

# Deploy all Azure resources
az deployment group create \
  --resource-group rg-paasworkshop-<your-username> \
  --template-file main.bicep \
  --parameters main.bicepparam
```

### Step 6: Trigger Application Deployment

Push a commit to trigger GitHub Actions:

```bash
git commit --allow-empty -m "Trigger deployment"
git push
```

Watch the deployment progress in the **Actions** tab of your repository.

---

## 📁 Repository Structure

```
Azure-PaaS-Workshop/
├── 📂 design/                          # Architecture specifications
│   ├── AzureArchitectureDesign.md      # Infrastructure design
│   ├── BackendApplicationDesign.md     # API design
│   ├── FrontendApplicationDesign.md    # Frontend design
│   ├── DatabaseDesign.md               # Cosmos DB design
│   ├── IaaS-PaaS-ComparisonMatrix.md   # IaaS vs PaaS comparison
│   ├── IaaS-to-PaaS-Migration-Changes.md # Migration guide
│   └── RepositoryWideDesignRules.md    # Coding standards
│
├── 📂 materials/
│   ├── 📂 backend/                     # Node.js Express API
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── 📂 frontend/                    # React + Vite SPA
│   │   ├── src/
│   │   ├── package.json
│   │   └── staticwebapp.config.json
│   │
│   ├── 📂 bicep/                       # Infrastructure as Code
│   │   ├── main.bicep
│   │   ├── main.bicepparam
│   │   └── modules/
│   │
│   └── 📂 docs/                        # Workshop documentation
│
├── 📂 scripts/
│   └── workshop-setup.sh               # Initial setup script
│
├── 📂 .github/workflows/               # CI/CD pipelines
│   ├── azure-static-web-apps.yml       # Frontend deployment
│   ├── backend-deploy.yml              # Backend deployment
│   └── infrastructure-deploy.yml       # Bicep deployment
│
└── 📂 iaas/                            # IaaS Workshop reference
    └── (IaaS workshop materials for comparison)
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────────────┐
│  Static Web Apps    │            │  Application Gateway + WAF v2   │
│  (React Frontend)   │            │  (API Protection)               │
│  ✓ Global CDN       │            │  ✓ OWASP 3.2 Rules             │
│  ✓ Free SSL         │            │  ✓ Bot Protection              │
│  ✓ GitHub Actions   │            └─────────────────────────────────┘
└─────────────────────┘                        │
                                               ▼ (Private Endpoint)
                            ┌─────────────────────────────────────────────┐
                            │              Virtual Network                 │
                            │  ┌─────────────────────────────────────┐    │
                            │  │        App Service (Node.js)        │    │
                            │  │        + VNet Integration           │    │
                            │  └─────────────────────────────────────┘    │
                            │           │                    │            │
                            │           ▼                    ▼            │
                            │  ┌──────────────┐    ┌──────────────┐       │
                            │  │  Cosmos DB   │    │  Key Vault   │       │
                            │  │  (MongoDB)   │    │  (Secrets)   │       │
                            │  │  Private EP  │    │  Private EP  │       │
                            │  └──────────────┘    └──────────────┘       │
                            └─────────────────────────────────────────────┘
```

---

## 📖 Workshop Modules

| Module | Topic | Time |
|--------|-------|------|
| **1** | [Infrastructure Deployment](materials/docs/module-1-infrastructure.md) | 60 min |
| **2** | [Backend Configuration](materials/docs/module-2-backend.md) | 45 min |
| **3** | [Frontend Deployment](materials/docs/module-3-frontend.md) | 30 min |
| **4** | [Security & Networking](materials/docs/module-4-security.md) | 45 min |
| **5** | [Monitoring & Observability](materials/docs/module-5-monitoring.md) | 30 min |

---

## 💰 Cost Estimate

Estimated workshop cost (Japan East region):

| Resource | SKU | Monthly Cost |
|----------|-----|--------------|
| Static Web Apps | Free | $0 |
| App Service | B1 | ~$13 |
| Cosmos DB vCore | M30 | ~$200 |
| Application Gateway | WAF_v2 (1 instance) | ~$250 |
| Key Vault | Standard | ~$1 |
| VNet / Private Endpoints | - | ~$10 |
| NAT Gateway | Standard | ~$45 |
| **Total** | | **~$520/month** |

> ⚠️ **Important**: Remember to delete resources after the workshop to avoid charges!

---

## 🧹 Cleanup

After completing the workshop, delete all Azure resources:

```bash
# Delete resource group (removes all contained resources)
az group delete --name rg-paasworkshop-<your-username> --yes --no-wait

# Delete App Registration
az ad app delete --id <app-id-from-setup>
```

Or use the saved configuration:

```bash
# If you have .workshop-config file
source .workshop-config
az group delete --name $RESOURCE_GROUP --yes --no-wait
az ad app delete --id $APP_ID
```

---

## 🔗 Related Resources

- [IaaS Workshop](./iaas/) - Compare with VM-based architecture
- [Azure PaaS Documentation](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB for MongoDB vCore](https://docs.microsoft.com/azure/cosmos-db/mongodb/vcore/)
- [Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)

---

## 📝 License

This workshop is provided under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

This workshop was created to help developers learn Azure PaaS services through hands-on experience. 

**Original Repository**: [hironariy/Azure-PaaS-Workshop](https://github.com/hironariy/Azure-PaaS-Workshop)

If you find this workshop helpful, please ⭐ star the original repository!
