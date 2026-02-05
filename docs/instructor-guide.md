# Azure PaaS Workshop - Instructor Guide

This guide provides teaching points, common issues, and discussion facilitation notes for instructors leading the Azure PaaS Workshop.

> **📝 Note:** This document is for instructors only. Students should follow the main [README.md](../README.md).

---

## Table of Contents

- [Workshop Overview](#workshop-overview)
- [Section 1: Introduction](#section-1-introduction)
- [Section 2: Prerequisites and Deployment](#section-2-prerequisites-and-deployment)
- [Section 3: Testing](#section-3-testing)
- [Section 4: IaaS vs PaaS Comparison](#section-4-iaas-vs-paas-comparison)
- [Common Student Issues](#common-student-issues)
- [Time Management Tips](#time-management-tips)

---

## Workshop Overview

### Workshop Format Options

| Format | Duration | Group Size | Notes |
|--------|----------|------------|-------|
| Instructor-led classroom | 4 hours | 20-45 students (10-15 groups) | Recommended |
| Virtual classroom | 4 hours | 20-45 students | Use breakout rooms for group work |
| Self-study | Variable | Individual | Students follow README independently |

### Suggested Timeline (4-hour format)

| Time | Duration | Activity |
|------|----------|----------|
| 0:00 | 20 min | Introduction and workshop overview |
| 0:20 | 60 min | Hands-on: Infrastructure deployment (Steps 1-4) |
| 1:20 | 15 min | Break |
| 1:35 | 60 min | Instructor explanation: Architecture, Bicep, Auth, Monitoring |
| 2:35 | 85 min | Hands-on: Application deployment and testing |

### Relationship to IaaS Workshop (Day 1)

This workshop is designed as Day 2 of a 2-day series:
- **Day 1:** [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) - VMs, Load Balancers, manual configuration
- **Day 2:** Azure PaaS Workshop (this workshop) - Managed services, reduced operational overhead

If students completed Day 1, emphasize the comparison points throughout the workshop.

---

## Section 1: Introduction

### Key Teaching Points

When introducing the workshop, emphasize:

1. **Trade-offs between IaaS and PaaS**
   - IaaS: More control, more responsibility
   - PaaS: Less control, managed by Microsoft
   
2. **Operational Overhead Reduction**
   - No OS patching required
   - Built-in high availability
   - Automatic scaling capabilities

3. **When to Choose PaaS vs IaaS**
   - PaaS: Stateless web apps, APIs, modern applications
   - IaaS: Custom OS requirements, legacy software, stateful applications

### Common Student Questions

| Question | Suggested Answer |
|----------|------------------|
| "When should I use App Service vs VMs?" | Discuss stateless vs stateful workloads. App Service is ideal for web apps and APIs that don't require custom OS configuration. |
| "Is PaaS more expensive?" | Show the TCO including operational costs. PaaS may have higher resource costs but lower operational costs. |
| "Can I migrate from IaaS to PaaS?" | Yes! This workshop demonstrates the same application on both platforms. Key considerations: database migration, connection string changes, deployment process changes. |

### Group Discussion Facilitation

**Discussion Topic:** "What do you expect to be different between IaaS and PaaS?"

Encourage students to share:
- Prior experience with PaaS services (Azure, AWS, or other)
- Concerns about vendor lock-in
- Questions about managed service limitations

---

## Section 2: Prerequisites and Deployment

### Entra ID Setup - Common Issues

This is often the most problematic section. Watch for:

1. **Wrong redirect URI type**
   - Students select "Web" instead of "Single-page application (SPA)"
   - Symptom: `AADSTS9002326` error during login
   - Fix: Delete the redirect URI and add it again with correct type

2. **Missing API permission**
   - Frontend app doesn't have permission to call Backend API
   - Symptom: 403 or "insufficient privileges" errors
   - Fix: Add API permission in Frontend app registration

3. **Scope not created**
   - `access_as_user` scope not created on Backend API
   - Symptom: "Invalid scope" error during login
   - Fix: Create the scope in Backend API → Expose an API

**Time-saving Tip:** If participants struggle with Entra ID setup, consider pre-creating the app registrations and sharing the client IDs.

### Bicep Deployment

**Deployment Time:**
- First deployment: ~10-15 minutes (Cosmos DB takes the longest)
- Subsequent deployments: ~3-5 minutes (incremental updates)

**What to explain while waiting:**

While Bicep deploys, explain what's being created:
1. Virtual Network with subnets (appservice, privateendpoint)
2. Cosmos DB with private endpoint (no public access)
3. Key Vault with private endpoint (secrets stored here)
4. App Service with VNet integration (can access private resources)
5. Static Web App (deployed empty, will add code later)

**Common Deployment Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing parameter" | Entra ID values not provided | Check `dev.local.bicepparam` |
| "Invalid password format" | Password doesn't meet requirements | Use alphanumeric + special characters |
| "Name already exists" | Resource naming conflict | Use unique resource group name per team |

### Application Deployment

**Backend Deployment:**
- Script takes ~2-3 minutes
- App startup takes 60-90 seconds (VNet integration + Key Vault resolution)
- If health check fails, wait and retry - this is normal for first deployment

**Frontend Deployment:**
- Config injection happens at deploy time (security feature)
- SWA CLI uploads the built files
- Linked Backend proxies `/api/*` to App Service

---

## Section 3: Testing

### Common Test Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 on API calls | Linked Backend not configured | Check SWA configuration in Azure Portal |
| CORS errors | Should not occur with Linked Backend | Verify SWA is correctly linked to App Service |
| Login redirect fails | Missing redirect URI | Add SWA URL to Entra ID Frontend app registration |
| "No account" after login | MSAL cache issue | Clear browser cache or use incognito |

### Verification Checklist

Help students verify their deployment is complete:

- [ ] Health endpoint returns 200: `https://<app-service>.azurewebsites.net/health`
- [ ] API via SWA returns 200: `https://<swa>.azurestaticapps.net/api/health`
- [ ] Frontend loads without console errors
- [ ] Can sign in with Microsoft account
- [ ] Can create, edit, and delete posts

---

## Section 4: IaaS vs PaaS Comparison

### Architecture Comparison Teaching Points

When reviewing the architecture differences:

1. **Static Web Apps + Linked Backend**
   - SWA proxies `/api/*` requests to App Service
   - No need for Application Gateway for API protection
   - Automatic SSL certificate management

2. **Private Endpoints**
   - Database and Key Vault are not exposed to the internet
   - App Service accesses them via private IP addresses
   - Compare to IaaS: VMs accessed private IPs directly within VNet

3. **VNet Integration**
   - App Service can access private resources
   - Outbound traffic goes through NAT Gateway
   - Compare to IaaS: VMs were directly in the VNet

4. **Managed Identity**
   - No credentials stored in code
   - App Service authenticates to Key Vault automatically
   - Compare to IaaS: Scripts fetched secrets from Key Vault

### Code Differences Discussion

**Key Points to Highlight:**

1. **Database Connection**
   - IaaS: MongoDB replica set with explicit IP addresses
   - PaaS: Cosmos DB with `mongodb+srv://` protocol and TLS required

2. **Configuration Loading**
   - IaaS: Nginx serves `/config.json` generated by Bicep
   - PaaS: Config injected into `index.html` at deploy time (more secure)

3. **API Routing**
   - IaaS: Application Gateway routes to VMs
   - PaaS: SWA Linked Backend proxies to App Service

### Group Discussion Facilitation

**Discussion Topic 1:** "When would you choose IaaS over PaaS?"

Expected answers:
- Custom OS requirements (e.g., specific Linux kernel)
- Stateful applications that need local storage
- Legacy software dependencies
- Specific hardware requirements (GPU, high memory)
- Regulatory requirements for dedicated infrastructure

**Discussion Topic 2:** "What are the trade-offs of managed services?"

Expected answers:
- Less control vs. less operational overhead
- Potential vendor lock-in vs. faster time-to-market
- Cost predictability vs. pay-per-use
- Limited customization vs. best-practice defaults

**Discussion Topic 3:** "How would you migrate from IaaS to PaaS?"

Key points to cover:
- Identify stateless vs. stateful components
- Evaluate database migration options
- Plan for connection string and config changes
- Consider hybrid approaches during migration

---

## Common Student Issues

### Quick Reference for Troubleshooting

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Bicep fails immediately | Missing parameters | Check `dev.local.bicepparam` |
| Deployment stuck at Cosmos DB | Normal - takes 10+ min | Wait; explain architecture |
| Backend 502 error | App not started | Wait 60-90 seconds |
| Backend 401 on /health | EasyAuth blocking | Check `/health` is excluded |
| Login fails with redirect error | Missing SWA URL in Entra ID | Add redirect URI |
| API calls fail with 404 | Linked Backend not working | Check SWA configuration |
| "tsc not found" during deploy | Remote build enabled | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` |

### Log Access Commands

Share these with students when debugging:

```bash
# Stream live logs (macOS/Linux)
az webapp log tail --resource-group <rg-name> --name <app-service-name>

# Download logs
az webapp log download --resource-group <rg-name> --name <app-service-name> --log-file /tmp/logs.zip
```

---

## Time Management Tips

### If Running Behind Schedule

1. **Skip local development** (Section 2.2) - it's optional
2. **Pre-deploy infrastructure** before the session starts
3. **Use pre-created Entra ID app registrations**
4. **Reduce testing scope** - just verify health endpoints

### If Running Ahead of Schedule

1. **Deep dive into Bicep modules** - explain each resource
2. **Explore Azure Portal** - show monitoring, logs, configuration
3. **Discuss production considerations** - scaling, BCDR, cost optimization
4. **Compare with IaaS architecture** - pull up Day 1 materials

### Checkpoints

Use these checkpoints to gauge class progress:

| Checkpoint | Expected Time | Action if Behind |
|------------|---------------|------------------|
| Tools verified | 10 min | Skip verification, trust installation |
| Entra ID complete | 30 min | Provide pre-created IDs |
| Bicep deployed | 50 min | Show Azure Portal while waiting |
| Backend deployed | 70 min | Share troubleshooting commands |
| Frontend deployed | 85 min | Focus on verification only |
| Testing complete | 100 min | Demonstrate CRUD quickly |

---

## Additional Resources

### For Instructors

- [MaterialsValidationStrategy.md](../design/MaterialsValidationStrategy.md) - Detailed testing strategy
- [AzureArchitectureDesign.md](../design/AzureArchitectureDesign.md) - Architecture decisions
- [BackendApplicationDesign.md](../design/BackendApplicationDesign.md) - Backend implementation details
- [FrontendApplicationDesign.md](../design/FrontendApplicationDesign.md) - Frontend implementation details

### For Students (After Workshop)

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB for MongoDB vCore](https://docs.microsoft.com/azure/cosmos-db/mongodb/vcore/)
- [Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [AZ-104 Certification](https://docs.microsoft.com/certifications/azure-administrator/)
- [AZ-305 Certification](https://docs.microsoft.com/certifications/azure-solutions-architect/)
