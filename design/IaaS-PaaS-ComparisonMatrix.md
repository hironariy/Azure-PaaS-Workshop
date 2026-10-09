# IaaS vs PaaS Comparison Matrix

**Purpose**: Define the key architectural differences between IaaS and PaaS workshops to guide specification development and workshop content.

**Status**: 🚧 DRAFT - Pending Review

**Comparison baseline**: [IaaS README revision 5aa79ac](https://github.com/hironariy/Azure-IaaS-Workshop/blob/5aa79ac5969e551f08295ad660f6b1ec6856eda6/README.md)
and the PaaS [current implementation contract](RepositoryWideDesignRules.md#current-baseline-contract).
IaaS uses three data-bearing MongoDB 8.0 members across zones 1/2/3, no arbiter.
The PaaS baseline is B1/M25/HA=false, not a like-for-like availability guarantee.

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
| **WAF/Gateway** | Application Gateway with WAF v2 | Not deployed; Entra is not a WAF replacement |
| **Web Tier** | NGINX on Ubuntu VMs (2 instances, AZ spread) | **Azure Static Web Apps** (globally distributed) |
| **App Tier** | Express/Node.js on Ubuntu VMs (2 instances) | **Azure App Service** (Linux, Node.js) |
| **Load Balancing** | Internal Load Balancer between Web→App | Built-in (**SWA Linked Backend**) |
| **DB Tier** | MongoDB Replica Set, 3 data-bearing members | **Azure DocumentDB / MongoDB vCore M25, HA=false** |
| **Networking** | VNet, Subnets, NSGs, NAT Gateway | VNet Integration, Private Endpoints (DB/KV only) |

### 2.2 Architecture Diagrams

**IaaS Architecture:**
```
Internet → App Gateway (WAF) → Web VMs (NGINX) → Internal LB → App VMs (Express) → DB VMs (MongoDB RS)
```

**PaaS Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Static Asset Flow (baseline does not deploy a separate WAF)                   │
│                                                                                 │
│  Browser ──→ Internet ──→ Static Web Apps (React SPA)                           │
│                           └── Built-in: Global CDN, Free SSL, DDoS protection   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  API Flow (SWA Linked Backend - routes to App Service automatically)            │
│                                                                                 │
│  Browser ──→ SWA (/api/*) ──→ Linked Backend ──→ App Service ──→ Cosmos DB      │
│              └── HTTPS managed by Azure  └── Entra ID auth   └── Private EP     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Why No Application Gateway for PaaS?**
- SWA serves **read-only static assets** (HTML, CSS, JS, images)
- Published reads/health are public; writes require Entra authentication and application authorization
- **SWA Linked Backend** provides automatic routing to App Service
- No SSL certificate management needed (Azure handles HTTPS)
- Avoids App Gateway resource costs; estimate actual SWA Standard/NAT/data/telemetry costs separately
- **Simplicity**: No self-signed certificate issues

---

## 3. Component-by-Component Comparison

### 3.1 Web/Frontend Tier

| Aspect | IaaS (NGINX on VMs) | PaaS (Static Web Apps) |
|--------|---------------------|------------------------|
| **Deployment** | Build → SCP to VM → NGINX config | Cloud Shell build/runtime config → SWA; Actions optional |
| **Scaling** | Manual (add VMs) | Automatic (global CDN) |
| **SSL/TLS** | App Gateway terminates | Built-in free SSL |
| **Custom Domain** | DNS + App Gateway config | DNS + SWA custom domain |
| **Cost** | VM hours + disks | Standard required for linked backend |
| **Ops Overhead** | High (OS patching, NGINX config) | Near zero |

### 3.2 App/Backend Tier

| Aspect | IaaS (Express on VMs) | PaaS (App Service) |
|--------|----------------------|-------------------|
| **Deployment** | SCP + PM2/systemd restart | Cloud Shell production ZIP; Actions optional |
| **Scaling** | Manual (add VMs + LB config) | B1 baseline; autoscale requires supported higher tier |
| **Environment Variables** | VM env files / Custom Script | App Service Configuration |
| **SSL/TLS** | Internal (HTTP within VNet) | HTTPS enforced, managed certs |
| **Managed Identity** | VM System-assigned MI | App Service System-assigned MI |
| **Deployment Slots** | N/A (blue-green via LB) | Not on B1; optional supported tier |
| **Cost** | VM hours | App Service Plan (B1/S1/P1v3) |
| **Ops Overhead** | High (OS patching, process mgmt) | Low (platform managed) |

### 3.3 Database Tier

| Aspect | IaaS (MongoDB on VMs) | PaaS (Cosmos DB for MongoDB vCore) |
|--------|----------------------|------------------------------------|
| **Service Type** | Self-managed MongoDB | Fully managed, MongoDB-compatible |
| **Foundation** | MongoDB Community Edition | Managed MongoDB-compatible service; verify feature compatibility |
| **Deployment** | VM setup + RS initialization | Bicep resource creation (cluster) |
| **High Availability** | 3 data-bearing members across zones | M25 has no in-region HA; baseline does not enable HA |
| **Scaling** | Vertical (larger VMs) | Vertical (vCore tiers) + Horizontal (sharding) |
| **Backup** | Azure Backup + mongodump | Managed backup/restore subject to tier/retention; restore not rehearsed |
| **Connection** | mongodb:// connection string | mongodb+srv:// connection string (compatible) |
| **SDK** | Mongoose ODM | Mongoose ODM (compatible) |
| **Global Distribution** | N/A | Not configured; optional design requires tier/region/approval |
| **Vector Search** | Manual setup required | Built-in vector search support |
| **Cost** | VM hours + disks for 3 members | M25 + storage; dated regional estimate required |
| **Ops Overhead** | High (patching, RS management) | Near zero (fully managed) |

### 3.4 Networking & Security

| Aspect | IaaS | PaaS |
|--------|------|------|
| **Network Isolation** | VNet + Subnets + NSGs | VNet Integration + Private Endpoints (DB/KV) |
| **Bastion Access** | Azure Bastion → SSH to VMs | N/A (no VMs to SSH into) |
| **Firewall Rules** | NSG rules per subnet | Data-service firewall/PE/DNS; Entra is a separate app-layer control |
| **API Protection** | Application Gateway WAF | **Entra ID + input validation** |
| **Private Connectivity** | Internal IPs within VNet | Private Endpoints for Cosmos DB/Key Vault |
| **API Routing** | NGINX proxy_pass | **SWA Linked Backend** |

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
| **API Proxy** | NGINX proxy_pass | **SWA Linked Backend** (automatic) |
| **Environment** | Check actual sister runtime configuration | Public window.__APP_CONFIG__ injected into build; API base /api |

### 4.3 Infrastructure as Code

| Component | IaaS (Bicep) | PaaS (Bicep) |
|-----------|--------------|--------------|
| **Compute** | VM resources, extensions, availability sets | App Service Plan + Web App |
| **Database** | VM resources + Custom Script for MongoDB | Managed cluster (Microsoft.DocumentDB/mongoClusters), not RU account |
| **Networking** | VNet, subnets, NSGs, LBs | VNet, Private Endpoints (DB/KV), VNet Integration |
| **Gateway** | Application Gateway | **Not required** (SWA Linked Backend) |
| **Secrets** | Key Vault + VM MI | Key Vault + App Service MI |
| **API Routing** | App Gateway backend pools | **SWA Linked Backend** resource |

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
- ✅ Deploy App Service B1; compare slots as optional supported-tier capability
- ✅ Configure Cosmos DB for MongoDB vCore (data modeling, indexing)
- ✅ Use Static Web Apps for frontend hosting
- ✅ Configure **SWA Linked Backend** for API routing
- ✅ Implement VNet Integration and Private Endpoints (DB/Key Vault)
- ✅ Understand **Entra ID authentication** as security boundary
- ✅ Understand SKU-dependent scaling, HA constraints and cost estimation
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

**Current decision**: the implementation uses `Microsoft.DocumentDB/mongoClusters`
(Azure DocumentDB / formerly Cosmos DB for MongoDB vCore). The options table
above is historical selection context, not proof of SLA, compatibility percentage
or enabled cross-region features. It must not be confused with RU Cosmos DB quotas.

### 6.2 Frontend Hosting

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Static Web Apps** | Standard linked API, global distribution | Standard cost/eligibility required | ✅ Selected |
| **App Service (static)** | Similar to App tier | Overkill for static files | Not recommended |
| **Azure Storage static** | Simple, cheap | No built-in CI/CD | Alternative option |

**Decision**: ✅ Use Static Web Apps

### 6.3 Application Gateway Necessity

| Scenario | Recommendation |
|----------|----------------|
| **Full comparison with IaaS** | Optional - shows WAF concept |
| **Simplified PaaS demo** | ✅ **SWA Linked Backend** - simpler, lower cost |

**Decision**: ✅ Use SWA Linked Backend (no Application Gateway) for simplified architecture and cost savings

---

## 7. Historical implementation checklist

This original checklist is retained for context, not current readiness.
Use the learner path and issue/PR acceptance evidence for release decisions.

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

## Appendix: Compare costs without false equivalence

Use a dated regional/currency quote for each actual topology. Include the
IaaS three DB members/disks/backup and its network resources; include PaaS
SWA Standard, B1, M25/storage, two private endpoints, NAT/public IP/data,
Key Vault and telemetry ingestion/retention. Do not promise a percentage
saving from obsolete two-node/Free-SWA monthly totals.

B1/M25/HA=false is not equivalent to the sister's zone-spread replica set.
Compare TCO, operating responsibility **and availability requirements**, not
resource price alone. See the [baseline cost checklist](../materials/bicep/README.md#estimate-costs-for-the-actual-baseline).
