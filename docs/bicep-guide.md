# Understanding Bicep: Infrastructure as Code for Azure

> 📚 **Target Audience**: Engineers learning Azure for AZ-104/AZ-305 certification

## Table of Contents

1. [What is Bicep?](#what-is-bicep)
2. [Bicep Language Fundamentals](#bicep-language-fundamentals)
3. [Azure Resource Model](#azure-resource-model)
4. [Workshop Bicep Structure Explained](#workshop-bicep-structure-explained)
5. [Key Azure Services in This Workshop](#key-azure-services-in-this-workshop)
6. [AZ-104/AZ-305 Exam Relevance](#az-104az-305-exam-relevance)
7. [Appendix: AWS Service Mapping](#appendix-aws-service-mapping)

---

## What is Bicep?

**Bicep** is Azure's domain-specific language (DSL) for deploying Azure resources declaratively. It provides a clean, readable syntax for defining Infrastructure as Code (IaC).

### Why Bicep?

| Benefit | Description |
|---------|-------------|
| **Readable syntax** | Clean, concise language designed for Azure |
| **First-class tooling** | VS Code extension with IntelliSense, validation |
| **No state management** | Azure Resource Manager tracks resource state |
| **Modular design** | Break complex deployments into reusable modules |
| **Type safety** | Compile-time validation catches errors early |
| **Native Azure integration** | Direct access to all Azure resource types and API versions |

### Bicep vs ARM Templates

Bicep compiles to ARM (Azure Resource Manager) JSON templates. You get the reliability of ARM with better developer experience.

```bicep
// Bicep - Clean and readable
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mystorageaccount'
  location: 'japaneast'
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
```

```json
// ARM Template - Equivalent JSON (auto-generated from Bicep)
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-01-01",
      "name": "mystorageaccount",
      "location": "japaneast",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2"
    }
  ]
}
```

### How Bicep Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Bicep File    │────▶│   ARM Template  │────▶│  Azure Resource │
│   (.bicep)      │     │   (.json)       │     │    Manager      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
    You write              Auto-compiled           Deploys to
    this code              by Bicep CLI              Azure
```

---

## Bicep Language Fundamentals

### 1. Parameters

Parameters accept input values at deployment time. They make your templates reusable.

```bicep
// Basic parameter with default value
param location string = 'japaneast'

// Parameter with validation
@minLength(3)
@maxLength(24)
@description('Name must be 3-24 characters, lowercase letters and numbers only')
param storageAccountName string

// Parameter with allowed values (enum-like)
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

// Secure parameter - value won't appear in logs or deployment history
@secure()
param adminPassword string

// Complex type parameter
param tags object = {
  Environment: 'dev'
  Project: 'Workshop'
}
```

**Common Decorators:**
| Decorator | Purpose |
|-----------|---------|
| `@description()` | Documentation for the parameter |
| `@allowed()` | Restrict to specific values |
| `@minLength()` / `@maxLength()` | String length constraints |
| `@minValue()` / `@maxValue()` | Numeric range constraints |
| `@secure()` | Hide value from logs and outputs |

### 2. Variables

Variables are computed values used within the template. They simplify complex expressions and promote consistency.

```bicep
// Simple variable
var resourcePrefix = 'myapp'

// Computed variable using string interpolation
var appServiceName = '${resourcePrefix}-${environment}-app'

// Object variable
var tags = {
  Environment: environment
  Project: 'Workshop'
  ManagedBy: 'Bicep'
  CreatedDate: utcNow('yyyy-MM-dd')
}

// Array variable
var allowedIpRanges = [
  '10.0.0.0/8'
  '172.16.0.0/12'
  '192.168.0.0/16'
]

// Conditional variable
var skuName = environment == 'prod' ? 'P1v3' : 'B1'
```

### 3. Resources

Resources are the core of Bicep - they define what Azure resources to create.

**Syntax:**
```bicep
resource <symbolic-name> '<resource-type>@<api-version>' = {
  name: '<resource-name>'
  location: '<location>'
  properties: {
    // Resource-specific configuration
  }
  tags: {
    // Metadata tags
  }
}
```

**Understanding Resource Types:**
```
Microsoft.Web/sites@2023-01-01
    │         │        │
    │         │        └── API Version (determines available properties)
    │         └── Resource Type
    └── Resource Provider (namespace)
```

**Example: App Service**
```bicep
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: 'mywebapp-${environment}'
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id  // Reference another resource
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: true
    }
  }
  tags: tags
}
```

**Key Concepts:**
- **Symbolic name**: Used to reference the resource within Bicep (e.g., `appService`)
- **Resource name**: The actual name in Azure (e.g., `'mywebapp-dev'`)
- **Implicit dependencies**: Bicep automatically determines deployment order based on references

### 4. Outputs

Outputs export values after deployment, useful for:
- Displaying important information (URLs, IPs)
- Passing values to other deployments or scripts
- Sharing information between modules

```bicep
// Simple output
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'

// Resource ID output (commonly used)
output appServiceId string = appService.id

// Resource name output
output appServiceName string = appService.name

// Conditional output
output databaseEndpoint string = deployDatabase ? cosmosDb.properties.documentEndpoint : 'N/A'

// Array output
output subnetIds array = [for subnet in subnets: subnet.id]
```

### 5. Modules

Modules enable code reuse and separation of concerns. Each module is a separate Bicep file.

**Calling a module:**
```bicep
// In main.bicep
module network 'modules/network.bicep' = {
  name: 'network-deployment'  // Deployment name in Azure
  params: {
    environment: environment
    location: location
    baseName: baseName
  }
}

// Using module outputs
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  properties: {
    virtualNetworkSubnetId: network.outputs.appServiceSubnetId
  }
}
```

**Module file structure:**
```bicep
// modules/network.bicep

// Parameters this module accepts
param environment string
param location string
param baseName string

// Resources the module creates
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'vnet-${baseName}-${environment}'
  location: location
  // ...
}

// Values the module exports
output vnetId string = vnet.id
output appServiceSubnetId string = vnet.properties.subnets[1].id
```

### 6. Conditions

Deploy resources conditionally based on parameter values.

```bicep
param deployRedis bool = false
param environment string = 'dev'

// Resource only deployed if condition is true
resource redis 'Microsoft.Cache/redis@2023-08-01' = if (deployRedis) {
  name: 'redis-${environment}'
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
  }
}

// Conditional property values
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  properties: {
    siteConfig: {
      alwaysOn: environment == 'prod' ? true : false
    }
  }
}
```

### 7. Loops

Create multiple resources or properties dynamically.

```bicep
// Loop over array
param storageAccountNames array = ['logs', 'data', 'backup']

resource storageAccounts 'Microsoft.Storage/storageAccounts@2023-01-01' = [for name in storageAccountNames: {
  name: '${baseName}${name}${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}]

// Loop with index
var subnetConfigs = [
  { name: 'frontend', prefix: '10.0.1.0/24' }
  { name: 'backend', prefix: '10.0.2.0/24' }
  { name: 'database', prefix: '10.0.3.0/24' }
]

resource subnets 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' = [for (config, i) in subnetConfigs: {
  name: config.name
  properties: {
    addressPrefix: config.prefix
  }
}]

// Accessing loop outputs
output storageAccountIds array = [for (name, i) in storageAccountNames: storageAccounts[i].id]
```

### 8. Built-in Functions

Bicep provides many useful functions:

```bicep
// Resource group functions
var rgLocation = resourceGroup().location
var rgName = resourceGroup().name
var rgId = resourceGroup().id

// Subscription functions
var subId = subscription().subscriptionId
var tenantId = subscription().tenantId

// String functions
var lowerName = toLower('MyApp')
var combined = concat('prefix-', baseName, '-suffix')
var formatted = '${baseName}-${environment}'  // String interpolation (preferred)

// Unique string (deterministic hash)
var uniqueSuffix = uniqueString(resourceGroup().id)
var uniqueName = '${baseName}${uniqueSuffix}'

// Resource ID construction
var storageId = resourceId('Microsoft.Storage/storageAccounts', storageName)

// Date/time
var timestamp = utcNow('yyyy-MM-ddTHH:mm:ssZ')

// Array functions
var firstItem = first(myArray)
var arrayLength = length(myArray)
var hasItem = contains(myArray, 'searchValue')
```

---

## Azure Resource Model

Understanding Azure's resource hierarchy is essential for effective Bicep deployments.

### Resource Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Microsoft Entra ID Tenant                            │
│                         (Identity & Access Management)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Management Groups                                  │
│                    (Organize subscriptions, apply policies)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │Subscription │   │Subscription │   │Subscription │
            │ (Production)│   │(Development)│   │  (Testing)  │
            └─────────────┘   └─────────────┘   └─────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │Resource │ │Resource │ │Resource │
   │ Group   │ │ Group   │ │ Group   │
   │ (App A) │ │ (App B) │ │(Shared) │
   └─────────┘ └─────────┘ └─────────┘
        │
        ├── Virtual Network
        ├── App Service
        ├── Cosmos DB
        ├── Key Vault
        └── ...
```

### Resource Groups

**Key Characteristics:**
- Logical container for resources that share the same lifecycle
- Resources in a group can be in different Azure regions
- Deleting a resource group deletes all resources within it
- Used as the deployment target for most Bicep deployments

```bicep
// Bicep deployment targets a resource group
targetScope = 'resourceGroup'  // Default, often omitted

// Deploy to subscription level (for resource groups, policies)
targetScope = 'subscription'

// Deploy to management group level (for policies across subscriptions)
targetScope = 'managementGroup'
```

### Deployment Scopes

| Scope | Use Case | Command |
|-------|----------|---------|
| Resource Group | Most resources | `az deployment group create` |
| Subscription | Resource groups, policies | `az deployment sub create` |
| Management Group | Cross-subscription policies | `az deployment mg create` |
| Tenant | Management groups | `az deployment tenant create` |

---

## Workshop Bicep Structure Explained

### Module Architecture

```
materials/bicep/
├── main.bicep              # 🎯 Orchestrator (entry point)
├── main.bicepparam         # 📝 Parameter values
├── README.md               # 📖 Documentation
└── modules/
    ├── network.bicep       # 🌐 Networking foundation
    ├── monitoring.bicep    # 📊 Observability stack
    ├── keyvault.bicep      # 🔐 Secrets management
    ├── cosmosdb.bicep      # 🗄️ Database layer
    ├── appservice.bicep    # ⚙️ API compute
    ├── appgateway.bicep    # 🛡️ WAF & load balancing
    └── staticwebapp.bicep  # 🌍 Frontend hosting
```

### Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           main.bicep (Orchestrator)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                                                            │
│  │  Parameters │  environment, location, baseName, credentials...          │
│  └──────┬──────┘                                                            │
│         │                                                                    │
│         ▼                                                                    │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║ Phase 1: Foundation (parallel)                                       ║   │
│  ║  ┌──────────────┐    ┌────────────────┐                             ║   │
│  ║  │   network    │    │   monitoring   │                             ║   │
│  ║  │  • VNet      │    │  • Log Analytics│                            ║   │
│  ║  │  • Subnets   │    │  • App Insights │                            ║   │
│  ║  │  • NAT GW    │    └────────────────┘                             ║   │
│  ║  │  • DNS Zones │                                                    ║   │
│  ║  └──────────────┘                                                    ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         │                                                                    │
│         ▼                                                                    │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║ Phase 2: Data & Security                                             ║   │
│  ║  ┌──────────────┐    ┌──────────────┐                               ║   │
│  ║  │   keyvault   │───▶│   cosmosdb   │  (stores secrets in KV)      ║   │
│  ║  │  • Key Vault │    │  • MongoDB   │                               ║   │
│  ║  │  • Private EP│    │  • Private EP│                               ║   │
│  ║  └──────────────┘    └──────────────┘                               ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         │                                                                    │
│         ▼                                                                    │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║ Phase 3: Compute                                                     ║   │
│  ║  ┌──────────────┐                                                    ║   │
│  ║  │  appservice  │  (depends on network, KV, cosmosdb, monitoring)  ║   │
│  ║  │  • App Plan  │                                                    ║   │
│  ║  │  • Web App   │                                                    ║   │
│  ║  │  • VNet Int. │                                                    ║   │
│  ║  │  • Private EP│                                                    ║   │
│  ║  └──────────────┘                                                    ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│         │                                                                    │
│         ▼                                                                    │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║ Phase 4: Edge & Frontend (parallel)                                  ║   │
│  ║  ┌──────────────┐    ┌────────────────┐                             ║   │
│  ║  │  appgateway  │    │  staticwebapp  │                             ║   │
│  ║  │  • WAF v2    │    │  • Global CDN  │                             ║   │
│  ║  │  • Public IP │    │  • Free tier   │                             ║   │
│  ║  └──────────────┘    └────────────────┘                             ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│                                                                              │
│  ┌─────────────┐                                                            │
│  │   Outputs   │  URLs, resource names, connection info                    │
│  └─────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Deep Dive

#### 1. network.bicep - Networking Foundation

**Creates:**
- Virtual Network with address space `10.1.0.0/16`
- Three purpose-specific subnets
- NAT Gateway for outbound internet access
- Private DNS Zones for Private Endpoints

**Subnet Design:**

| Subnet | CIDR | Purpose | Special Configuration |
|--------|------|---------|----------------------|
| `snet-appgw` | `10.1.0.0/24` | Application Gateway | None (AppGW requires dedicated subnet) |
| `snet-appservice` | `10.1.1.0/24` | App Service outbound | Delegation + NAT Gateway |
| `snet-privateendpoint` | `10.1.2.0/24` | Private Endpoints | Network policies disabled |

**Key Bicep Pattern - Subnet Delegation:**
```bicep
{
  name: 'snet-appservice'
  properties: {
    addressPrefix: '10.1.1.0/24'
    natGateway: {
      id: natGateway.id
    }
    delegations: [
      {
        name: 'Microsoft.Web.serverFarms'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'  // Required for VNet Integration
        }
      }
    ]
  }
}
```

#### 2. keyvault.bicep - Secrets Management

**Purpose:** Securely store and manage secrets, keys, and certificates.

**Key Features:**
- RBAC authorization (Azure's recommended approach over access policies)
- Private Endpoint (no public network access)
- Soft delete enabled (accidental deletion protection)

**Security Pattern - Key Vault Reference in App Service:**
```bicep
// Instead of passing secrets directly...
// ❌ Bad: secret visible in deployment
appSettings: [
  { name: 'DB_PASSWORD', value: myPassword }
]

// ✅ Good: App Service retrieves from Key Vault at runtime
appSettings: [
  { 
    name: 'DB_PASSWORD'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=db-password)'
  }
]
```

#### 3. appservice.bicep - API Compute Layer

**Critical Security Pattern - Separate Main Site vs SCM Rules:**

```bicep
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  properties: {
    // Main site: Private only (accessed via Application Gateway)
    publicNetworkAccess: 'Disabled'
    ipSecurityRestrictionsDefaultAction: 'Deny'
    
    // SCM/Kudu site: Public for GitHub Actions deployment
    scmIpSecurityRestrictionsUseMain: false  // ⭐ Key setting
    scmIpSecurityRestrictionsDefaultAction: 'Allow'
  }
}
```

**Why This Matters:**
- Main site protected by Private Endpoint + Application Gateway WAF
- SCM (deployment endpoint) must be accessible from GitHub Actions
- Without this separation, CI/CD pipelines can't deploy

#### 4. appgateway.bicep - Web Application Firewall

**Purpose:** Layer 7 load balancing with WAF protection for the API.

**WAF Configuration:**
```bicep
resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2023-09-01' = {
  properties: {
    policySettings: {
      mode: 'Prevention'  // Block attacks (vs 'Detection' = log only)
      state: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'  // Protects against SQL injection, XSS, etc.
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'  // Bot detection
        }
      ]
    }
  }
}
```

---

## Key Azure Services in This Workshop

### Virtual Network (VNet)

**What it is:** Isolated network environment in Azure.

**Key Concepts:**
- Address space (e.g., `10.1.0.0/16`)
- Subnets divide the address space
- NSGs (Network Security Groups) control traffic
- Peering connects VNets together

### App Service

**What it is:** Fully managed platform for web apps and APIs.

**Key Concepts:**
- **App Service Plan**: The compute resources (CPU, memory, features)
- **Web App**: Your application running on the plan
- **Deployment slots**: Staging environments (Standard tier+)
- **VNet Integration**: Outbound connectivity to VNet resources
- **Private Endpoint**: Inbound connectivity from VNet

**Pricing Tiers:**
| Tier | Features | Use Case |
|------|----------|----------|
| Free/Shared | Limited, shared compute | Testing |
| Basic (B1-B3) | Dedicated compute, custom domains | Dev/Test |
| Standard (S1-S3) | Auto-scale, deployment slots, backups | Production |
| Premium (P1-P3v3) | Enhanced performance, more instances | High-traffic |

### Cosmos DB for MongoDB vCore

**What it is:** Fully managed MongoDB-compatible database.

**Why vCore (not RU-based)?**
- Familiar MongoDB experience
- Predictable pricing (not request-unit based)
- Full MongoDB wire protocol compatibility
- Easier migration from existing MongoDB

### Key Vault

**What it is:** Centralized secrets, keys, and certificate management.

**Access Methods:**
- **RBAC** (recommended): Azure role assignments
- **Access Policies** (legacy): Vault-level permissions

**Common Roles:**
| Role | Permissions |
|------|-------------|
| Key Vault Administrator | Full access |
| Key Vault Secrets User | Read secrets |
| Key Vault Secrets Officer | Manage secrets |
| Key Vault Crypto User | Cryptographic operations |

### Application Gateway

**What it is:** Layer 7 (HTTP/HTTPS) load balancer with optional WAF.

**Components:**
- **Frontend IP**: Public or private IP for receiving traffic
- **Listeners**: Port and protocol configuration
- **Backend pools**: Target servers/services
- **HTTP settings**: How to connect to backends
- **Rules**: Route traffic from listeners to backends
- **Health probes**: Monitor backend health

### Static Web Apps

**What it is:** Hosting for static content (HTML, CSS, JS) with integrated CI/CD.

**Key Features:**
- Global distribution (CDN-like)
- Free SSL certificates
- GitHub Actions integration
- Staging environments for pull requests
- API integration (Azure Functions or external)

---

## AZ-104/AZ-305 Exam Relevance

### AZ-104: Azure Administrator

This workshop directly covers these exam objectives:

| Domain | Topics Covered |
|--------|----------------|
| **Manage Azure identities and governance** | Managed Identity, RBAC, Key Vault access |
| **Implement and manage storage** | Key Vault for secrets |
| **Deploy and manage Azure compute resources** | App Service, App Service Plans |
| **Configure and manage virtual networking** | VNet, Subnets, Private Endpoints, NAT Gateway, NSG |
| **Monitor and maintain Azure resources** | Log Analytics, Application Insights |

### AZ-305: Azure Solutions Architect Expert

This workshop covers these design areas:

| Domain | Topics Covered |
|--------|----------------|
| **Design identity, governance, and monitoring** | Managed Identity, RBAC, monitoring architecture |
| **Design data storage solutions** | Cosmos DB design, Key Vault patterns |
| **Design business continuity solutions** | Private Endpoints, redundancy |
| **Design infrastructure solutions** | VNet design, App Gateway, PaaS networking |

### Key Exam Concepts Demonstrated

1. **Private Endpoints vs Service Endpoints**
   - This workshop uses **Private Endpoints** (private IP in your VNet)
   - Service Endpoints route traffic over Azure backbone but keep public IP

2. **App Service Networking**
   - **VNet Integration**: App Service can reach resources in VNet (outbound)
   - **Private Endpoint**: Resources can reach App Service privately (inbound)

3. **Application Gateway vs Azure Front Door**
   - **App Gateway**: Regional, VNet integrated, WAF
   - **Front Door**: Global, edge locations, can't integrate with VNet directly

4. **Key Vault Access Patterns**
   - Managed Identity + RBAC (used in this workshop)
   - Access Policies (legacy approach)

---

## Hands-On Exercises

### Exercise 1: Explore the Bicep Structure

```bash
# Navigate to the bicep folder
cd materials/bicep

# View the main template
cat main.bicep

# List all modules
ls -la modules/

# Examine a specific module
cat modules/network.bicep
```

### Exercise 2: Validate and Build

```bash
# Validate syntax (build to ARM JSON)
az bicep build --file main.bicep

# Run linter for best practices
az bicep lint --file main.bicep

# Preview what would be deployed
az deployment group what-if \
  --resource-group rg-paasworkshop-dev \
  --template-file main.bicep \
  --parameters main.bicepparam
```

### Exercise 3: Understand Dependencies

Review `main.bicep` and answer:
1. Which modules have no dependencies and deploy in parallel?
2. Which modules explicitly depend on others?
3. How does `appService` module get the Key Vault name?

### Exercise 4: Modify a Module

Try adding a new tag to all resources:
1. Add a parameter `param costCenter string = 'IT'` to `main.bicep`
2. Add it to the `tags` variable
3. Run `az bicep build` to validate
4. Run `what-if` to see the changes

---

## Additional Resources

### Official Documentation
- [Bicep Documentation](https://docs.microsoft.com/azure/azure-resource-manager/bicep/)
- [Bicep Playground](https://aka.ms/bicepdemo) - Try Bicep in browser
- [Azure Resource Manager Templates](https://docs.microsoft.com/azure/templates/)

### Learning Paths
- [Deploy and manage resources with Bicep](https://docs.microsoft.com/learn/paths/bicep-deploy/)
- [AZ-104 Learning Path](https://docs.microsoft.com/learn/certifications/azure-administrator/)
- [AZ-305 Learning Path](https://docs.microsoft.com/learn/certifications/azure-solutions-architect/)

### Tools
- [VS Code Bicep Extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-bicep) - IntelliSense, validation, visualization
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli)
- [Azure Resource Explorer](https://resources.azure.com) - View existing resources as JSON

---

## Appendix: AWS Service Mapping

For engineers with AWS experience, here's a quick reference:

| Azure Service (This Workshop) | AWS Equivalent |
|------------------------------|----------------|
| Resource Group | No direct equivalent (closest: tags + CloudFormation stack) |
| Virtual Network | VPC |
| Subnet | Subnet |
| NAT Gateway | NAT Gateway |
| Private Endpoint | VPC Endpoint (Interface type) |
| Private DNS Zone | Route 53 Private Hosted Zone |
| App Service | Elastic Beanstalk / ECS Fargate |
| App Service Plan | EC2 instance type selection |
| Cosmos DB for MongoDB | DocumentDB |
| Key Vault | Secrets Manager + KMS |
| Application Gateway | Application Load Balancer |
| WAF v2 | AWS WAF |
| Static Web Apps | S3 + CloudFront + Amplify |
| Log Analytics | CloudWatch Logs |
| Application Insights | X-Ray + CloudWatch |
| Managed Identity | IAM Role for EC2/ECS |
| Bicep | CloudFormation / CDK |

---

## Summary

This workshop demonstrates a production-ready Azure PaaS architecture using Bicep:

| Layer | Resources | Key Patterns |
|-------|-----------|--------------|
| **Network** | VNet, Subnets, NAT Gateway, Private DNS | Subnet delegation, Private Endpoints |
| **Security** | Key Vault, Managed Identity | RBAC, Key Vault references |
| **Data** | Cosmos DB for MongoDB vCore | Private Endpoint, connection string in Key Vault |
| **Compute** | App Service | VNet Integration, separate SCM rules |
| **Edge** | Application Gateway WAF v2 | OWASP rules, backend pools |
| **Frontend** | Static Web Apps | Global distribution, GitHub CI/CD |
| **Monitoring** | Log Analytics, App Insights | Workspace-based insights |

The Bicep templates demonstrate modular design, dependency management, and Azure best practices that align with AZ-104 and AZ-305 certification objectives.
