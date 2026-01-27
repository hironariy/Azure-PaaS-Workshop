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
| **Web Tier** | NGINX on Ubuntu VMs (2 instances, AZ spread) | **Azure Static Web Apps** (globally distributed) |
| **App Tier** | Express/Node.js on Ubuntu VMs (2 instances) | **Azure App Service** (Linux, Node.js) |
| **Load Balancing** | Internal Load Balancer between Web→App | Built-in (App Service handles internally) |
| **DB Tier** | MongoDB Replica Set on VMs (2 nodes) | **Azure Cosmos DB for MongoDB vCore** |
| **Networking** | VNet, Subnets, NSGs, NAT Gateway | VNet Integration, Private Endpoints |

### 2.2 Architecture Diagrams

**IaaS Architecture:**
```
Internet → App Gateway (WAF) → Web VMs (NGINX) → Internal LB → App VMs (Express) → DB VMs (MongoDB RS)
```

**PaaS Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Static Asset Flow (No WAF needed - read-only content with built-in protection) │
│                                                                                 │
│  Browser ──→ Internet ──→ Static Web Apps (React SPA)                           │
│                           └── Built-in: Global CDN, Free SSL, DDoS protection   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  API Flow (WAF required - protects writable endpoints and sensitive data)       │
│                                                                                 │
│  Browser ──→ Internet ──→ App Gateway (WAF v2) ──→ App Service ──→ Cosmos DB    │
│                           └── WAF: SQL injection, XSS, Bot protection           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Why No App Gateway for Static Web Apps?**
- SWA serves **read-only static assets** (HTML, CSS, JS, images)
- SWA includes **built-in DDoS protection**, **global CDN**, and **free SSL**
- WAF rules (SQL injection, XSS) are irrelevant for static file serving
- Adding App Gateway would increase **latency** (+10-50ms) and **cost** (~$250/month) with minimal security benefit
- **Attack surface is the API**, not the static frontend

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

| Aspect | IaaS (MongoDB on VMs) | PaaS (Cosmos DB for MongoDB vCore) |
|--------|----------------------|------------------------------------|
| **Service Type** | Self-managed MongoDB | Fully managed, MongoDB-compatible |
| **Foundation** | MongoDB Community Edition | Cosmos DB engine with MongoDB wire protocol |
| **Deployment** | VM setup + RS initialization | Bicep resource creation (cluster) |
| **High Availability** | Manual RS config (2 nodes) | Built-in HA (99.995% SLA) |
| **Scaling** | Vertical (larger VMs) | Vertical (vCore tiers) + Horizontal (sharding) |
| **Backup** | Azure Backup + mongodump | Automatic continuous backup (PITR) |
| **Connection** | mongodb:// connection string | mongodb+srv:// connection string (compatible) |
| **SDK** | Mongoose ODM | Mongoose ODM (compatible) |
| **Global Distribution** | N/A | Optional geo-replicas |
| **Vector Search** | Manual setup required | Built-in vector search support |
| **Cost** | VM hours + Premium SSD | vCore-based (M30: ~$200/mo, predictable) |
| **Ops Overhead** | High (patching, RS management) | Near zero (fully managed) |

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
| **Database Connection** | Mongoose + MongoDB RS connection string | Mongoose + Cosmos DB vCore connection string |
| **Environment Config** | `MONGODB_URI` env var | `COSMOS_CONNECTION_STRING` or same `MONGODB_URI` |
| **Code Changes** | N/A | Minimal (connection string format only) |
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
| **Database** | VM resources + Custom Script for MongoDB | Cosmos DB account + database (Microsoft.DocumentDB/mongoClusters) |
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
- ✅ Configure Cosmos DB for MongoDB vCore (data modeling, indexing)
- ✅ Use Static Web Apps for frontend hosting
- ✅ Implement VNet Integration and Private Endpoints
- ✅ Use Application Gateway with WAF for PaaS backends
- ✅ Understand auto-scaling and cost optimization
- ✅ Learn Cosmos DB benefits (global distribution options, vector search)

---

## 6. Decision Points for PaaS Workshop

### 6.1 Database Service Choice

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Cosmos DB for MongoDB vCore** | High MongoDB compatibility, vCore pricing familiar, Mongoose works, mature ecosystem with extensive documentation, vector search built-in | Regional deployment (not global by default) | ✅ **Selected** - Mature service with comprehensive learning resources |
| **Cosmos DB for MongoDB (RU-based)** | Serverless option, global distribution, 99.999% SLA | RU pricing unfamiliar, partial MongoDB compatibility | For global-scale scenarios |
| **Cosmos DB NoSQL API** | Best Cosmos DB features, highest performance | Requires complete SDK rewrite | Not recommended (too different from IaaS) |
| **Azure DocumentDB** | 99.03% MongoDB compatible, open-source (MIT), multi-cloud | Newer service with less documentation available | Alternative for multi-cloud focus |

**Decision**: ✅ **Cosmos DB for MongoDB vCore** - Selected for its mature ecosystem, extensive documentation and tutorials, good MongoDB compatibility, and familiar vCore pricing model that workshop participants can easily understand.

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

1. [x] ~~Finalize Database service choice~~ → **Cosmos DB for MongoDB vCore**
2. [x] ~~Finalize Frontend hosting~~ → **Static Web Apps (direct access, no App GW)**
3. [x] ~~Finalize App Gateway scope~~ → **API protection only (App Service)**
4. [x] ~~Create `AzureArchitectureDesign.md`~~ → PaaS infrastructure specification
5. [x] ~~Create `DatabaseDesign.md`~~ → Cosmos DB vCore data modeling
6. [x] ~~Create `BackendApplicationDesign.md`~~ → App Service deployment patterns
7. [x] ~~Create `FrontendApplicationDesign.md`~~ → SWA configuration
8. [x] ~~Create `IaaS-to-PaaS-Migration-Changes.md`~~ → Detailed file-by-file change document
9. [ ] Create `RepositoryWideDesignRules.md` for PaaS-specific patterns
10. [ ] Implement Bicep templates based on specifications
11. [ ] Adapt backend code for Cosmos DB connection
12. [ ] Adapt frontend code for SWA deployment

---

## Appendix: Cost Comparison Estimates

| Component | IaaS Monthly Cost (Est.) | PaaS Monthly Cost (Est.) | Notes |
|-----------|--------------------------|--------------------------|-------|
| Web Tier | 2x Standard_B2s (~$60) | SWA Free tier ($0) | No App GW needed for SWA |
| App Tier | 2x Standard_B2s (~$60) | App Service B1 (~$13) or S1 (~$73) | Protected by App GW |
| DB Tier | 2x Standard_B4ms (~$240) | Cosmos DB vCore M30 (~$200) | Managed MongoDB compatible |
| App Gateway | WAF v2 (~$250) | WAF v2 (~$250) | API protection only |
| **Total** | **~$610/month** | **~$465-525/month** | ~25% cost reduction |

*Note: Estimates for Japan East region, actual costs vary by usage*
