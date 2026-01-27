# IaaS vs PaaS Comparison Matrix

**Purpose**: Define the key architectural differences between IaaS and PaaS workshops to guide specification development and workshop content.

**Status**: 🚧 DRAFT - Pending Review

**Last Updated**: 2026-01-27

---

## 1. Workshop Comparison Overview

| Aspect | IaaS Workshop | PaaS Workshop |
|--------|---------------|---------------|
| **Focus** | Infrastructure management, VM operations | Application deployment, managed services |
| **Learning Outcome** | Understand Azure networking, VMs, HA patterns | Understand PaaS benefits, less ops overhead |
| **Target Audience** | Engineers learning Azure IaaS from AWS | Engineers comparing IaaS vs PaaS trade-offs |
| **Complexity** | Higher (more components to manage) | Lower (Azure manages infrastructure) |

---

## 2. Architecture Comparison

### 2.1 High-Level Architecture

| Tier | IaaS Workshop | PaaS Workshop |
|------|---------------|---------------|
| **WAF/Gateway** | Application Gateway with WAF v2 | Application Gateway with WAF v2 |
| **Web Tier** | NGINX on Ubuntu VMs (2 instances, AZ spread) | **Azure Static Web Apps** (global CDN) |
| **App Tier** | Express/Node.js on Ubuntu VMs (2 instances) | **Azure App Service** (Linux, Node.js) |
| **Load Balancing** | Internal Load Balancer between Web→App | Built-in (App Service handles internally) |
| **DB Tier** | MongoDB Replica Set on VMs (2 nodes) | **Azure Cosmos DB** (MongoDB API or NoSQL) |
| **Networking** | VNet, Subnets, NSGs, NAT Gateway | VNet Integration, Private Endpoints |

### 2.2 Architecture Diagrams

**IaaS Architecture:**
```
Internet → App Gateway (WAF) → Web VMs (NGINX) → Internal LB → App VMs (Express) → DB VMs (MongoDB RS)
```

**PaaS Architecture:**
```
Internet → App Gateway (WAF) → Static Web Apps (React SPA)
                             → App Service (Express API) → Cosmos DB
```

---

## 3. Component-by-Component Comparison

### 3.1 Web/Frontend Tier

| Aspect | IaaS (NGINX on VMs) | PaaS (Static Web Apps) |
|--------|---------------------|------------------------|
| **Deployment** | Build → SCP to VM → NGINX config | Build → GitHub Actions → SWA |
| **Scaling** | Manual (add VMs) | Automatic (global CDN) |
| **SSL/TLS** | App Gateway terminates | Built-in free SSL |
| **Custom Domain** | DNS + App Gateway config | DNS + SWA custom domain |
| **Cost** | VM hours + disks | Free tier available |
| **Ops Overhead** | High (OS patching, NGINX config) | Near zero |

### 3.2 App/Backend Tier

| Aspect | IaaS (Express on VMs) | PaaS (App Service) |
|--------|----------------------|-------------------|
| **Deployment** | SCP + PM2/systemd restart | Git push / GitHub Actions |
| **Scaling** | Manual (add VMs + LB config) | Auto-scale rules (CPU, memory, HTTP) |
| **Environment Variables** | VM env files / Custom Script | App Service Configuration |
| **SSL/TLS** | Internal (HTTP within VNet) | HTTPS enforced, managed certs |
| **Managed Identity** | VM System-assigned MI | App Service System-assigned MI |
| **Deployment Slots** | N/A (blue-green via LB) | Built-in staging slots |
| **Cost** | VM hours | App Service Plan (B1/S1/P1v3) |
| **Ops Overhead** | High (OS patching, process mgmt) | Low (platform managed) |

### 3.3 Database Tier

| Aspect | IaaS (MongoDB on VMs) | PaaS (Cosmos DB) |
|--------|----------------------|------------------|
| **Deployment** | VM setup + RS initialization | Bicep resource creation |
| **High Availability** | Manual RS config (2 nodes) | Built-in (multi-region optional) |
| **Scaling** | Vertical (larger VMs) | Horizontal (RU/s or autoscale) |
| **Backup** | Azure Backup + mongodump | Automatic continuous backup |
| **Connection** | mongodb:// connection string | Cosmos DB connection string |
| **SDK** | Mongoose ODM | **Cosmos DB SDK** or Mongoose (MongoDB API) |
| **Cost** | VM hours + Premium SSD | RU/s consumption or serverless |
| **Ops Overhead** | High (patching, RS management) | Near zero |

### 3.4 Networking & Security

| Aspect | IaaS | PaaS |
|--------|------|------|
| **Network Isolation** | VNet + Subnets + NSGs | VNet Integration + Private Endpoints |
| **Bastion Access** | Azure Bastion → SSH to VMs | N/A (no VMs to SSH into) |
| **Firewall Rules** | NSG rules per subnet | App Service access restrictions |
| **Private Connectivity** | Internal IPs within VNet | Private Endpoints for Cosmos DB |

---

## 4. Code Changes Required (IaaS → PaaS)

### 4.1 Backend Changes

| Component | IaaS Implementation | PaaS Changes Required |
|-----------|--------------------|-----------------------|
| **Database Connection** | Mongoose + MongoDB RS connection string | Option A: Mongoose + Cosmos DB MongoDB API<br>Option B: @azure/cosmos SDK |
| **Environment Config** | `MONGODB_URI` env var | `COSMOS_CONNECTION_STRING` or `COSMOS_ENDPOINT` + MI |
| **Health Checks** | Custom `/health` endpoint | Same + App Service health checks |
| **Logging** | Winston to stdout/files | Winston to stdout → App Service logs |

### 4.2 Frontend Changes

| Component | IaaS Implementation | PaaS Changes Required |
|-----------|--------------------|-----------------------|
| **Build Output** | Static files → NGINX | Static files → SWA |
| **API Proxy** | NGINX proxy_pass | SWA `staticwebapp.config.json` routes |
| **Environment** | Build-time VITE_API_URL | SWA environment variables |

### 4.3 Infrastructure as Code

| Component | IaaS (Bicep) | PaaS (Bicep) |
|-----------|--------------|--------------|
| **Compute** | VM resources, extensions, availability sets | App Service Plan + Web App |
| **Database** | VM resources + Custom Script for MongoDB | Cosmos DB account + database + containers |
| **Networking** | VNet, subnets, NSGs, LBs | VNet, Private Endpoints, VNet Integration |
| **Gateway** | Application Gateway | Application Gateway (similar) |
| **Secrets** | Key Vault + VM MI | Key Vault + App Service MI |

---

## 5. Workshop Learning Objectives Comparison

### 5.1 IaaS Workshop Objectives
- ✅ Understand Azure VNet, subnets, NSGs
- ✅ Deploy and manage VMs across Availability Zones
- ✅ Configure load balancers (external + internal)
- ✅ Set up MongoDB Replica Set manually
- ✅ Use Application Gateway with WAF
- ✅ Implement Managed Identity for VMs

### 5.2 PaaS Workshop Objectives
- ✅ Compare IaaS vs PaaS trade-offs
- ✅ Deploy App Service with deployment slots
- ✅ Configure Cosmos DB (data modeling, partition keys)
- ✅ Use Static Web Apps for frontend hosting
- ✅ Implement VNet Integration and Private Endpoints
- ✅ Use Application Gateway with WAF for PaaS backends
- ✅ Understand auto-scaling and cost optimization

---

## 6. Decision Points for PaaS Workshop

### 6.1 Cosmos DB API Choice

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **MongoDB API** | Minimal code changes, reuse Mongoose | Limited Cosmos DB features | ✅ For minimal migration effort |
| **NoSQL API** | Full Cosmos DB features, better perf | Requires SDK rewrite | Consider for advanced workshop |

**Decision**: _TBD - Document in DatabaseDesign.md_

### 6.2 Frontend Hosting

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Static Web Apps** | Free tier, global CDN, GitHub integration | Different from IaaS pattern | ✅ Shows PaaS benefits clearly |
| **App Service (static)** | Similar to App tier | Overkill for static files | Not recommended |
| **Azure Storage static** | Simple, cheap | No built-in CI/CD | Alternative option |

**Decision**: ✅ Use Static Web Apps

### 6.3 Application Gateway Necessity

| Scenario | Recommendation |
|----------|----------------|
| **Full comparison with IaaS** | ✅ Keep App Gateway + WAF (shows same WAF works for PaaS) |
| **Simplified PaaS demo** | Use App Service built-in WAF or Front Door |

**Decision**: ✅ Keep Application Gateway for comparison purposes

---

## 7. Next Steps

1. [ ] Finalize Cosmos DB API choice (MongoDB API vs NoSQL API)
2. [ ] Create `AzureArchitectureDesign.md` with PaaS components
3. [ ] Create `DatabaseDesign.md` for Cosmos DB data modeling
4. [ ] Create `BackendApplicationDesign.md` with SDK changes
5. [ ] Create `FrontendApplicationDesign.md` with SWA configuration

---

## Appendix: Cost Comparison Estimates

| Component | IaaS Monthly Cost (Est.) | PaaS Monthly Cost (Est.) |
|-----------|--------------------------|--------------------------|
| Web Tier | 2x Standard_B2s (~$60) | SWA Free tier ($0) |
| App Tier | 2x Standard_B2s (~$60) | App Service B1 (~$13) or S1 (~$73) |
| DB Tier | 2x Standard_B4ms (~$240) | Cosmos DB Serverless (~$25-50) |
| App Gateway | WAF v2 (~$250) | WAF v2 (~$250) |
| **Total** | **~$610/month** | **~$290-375/month** |

*Note: Estimates for Japan East region, actual costs vary by usage*
