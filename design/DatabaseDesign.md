# Database Design Specification (Cosmos DB for MongoDB vCore)

## Overview

This document defines the database architecture and schema requirements for the Azure PaaS Workshop blog application using Azure Cosmos DB for MongoDB vCore.

**Reference**: The schema design is compatible with the [IaaS Workshop MongoDB schema](../iaas/design/DatabaseDesign.md) to enable direct comparison and minimal code changes.

## Database Overview

- **Database Service**: Azure Cosmos DB for MongoDB vCore
- **MongoDB Wire Protocol**: Compatible (MongoDB 6.0+)
- **Deployment Pattern**: Managed cluster with built-in HA
- **Backup Strategy**: Automatic continuous backup with PITR
- **Target Users**: Workshop students learning PaaS database patterns
- **Educational Focus**: Demonstrate managed MongoDB migration, minimal code changes

---

## Cosmos DB for MongoDB vCore Architecture

### Cluster Configuration

#### Cluster Topology

| Aspect | IaaS (MongoDB on VMs) | PaaS (Cosmos DB vCore) |
|--------|----------------------|------------------------|
| **Nodes** | 2 VMs (manual RS) | Managed cluster (HA built-in) |
| **Failover** | Manual intervention (2-node) | Automatic (managed) |
| **Backup** | Azure Backup + mongodump | Continuous backup (PITR) |
| **Patching** | Manual OS/MongoDB updates | Fully managed |
| **Scaling** | Vertical (larger VMs) | Vertical (tier upgrade) |

#### Recommended Tier for Workshop

| Tier | vCores | Memory | Storage | Use Case |
|------|--------|--------|---------|----------|
| M25 | 2 | 8 GB | 32 GB | Minimum viable |
| **M30** | 2 | 8 GB | 128 GB | ✅ Workshop recommended |
| M40 | 4 | 16 GB | 128 GB | Production |
| M50 | 8 | 32 GB | 128 GB | High performance |

**Workshop Choice: M30**
- Sufficient compute for 20-30 concurrent users
- 128 GB storage for blog data with room to grow
- HA enabled within region
- Cost-effective for learning environment (~$200/month)

### Connection Configuration

#### Connection String Format

**Cosmos DB vCore Connection String**:
```
mongodb+srv://blogadmin:<password>@<cluster-name>.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000
```

**Comparison with IaaS MongoDB**:
```
# IaaS (MongoDB Replica Set)
mongodb://blogapp:<password>@10.0.3.4:27017,10.0.3.5:27017/blogapp?replicaSet=blogapp-rs0&authSource=blogapp

# PaaS (Cosmos DB vCore)
mongodb+srv://blogadmin:<password>@blogapp-cluster.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256
```

**Key Differences**:

| Aspect | IaaS MongoDB | Cosmos DB vCore |
|--------|--------------|-----------------|
| **Protocol** | `mongodb://` | `mongodb+srv://` (SRV record) |
| **Hosts** | Explicit IP addresses | Single FQDN (SRV handles) |
| **TLS** | Optional | Required (`tls=true`) |
| **Auth Mechanism** | Default | `SCRAM-SHA-256` required |
| **Retry Writes** | `true` (default) | `false` (Cosmos limitation) |

#### Mongoose Connection Code

**Minimal Changes Required** (from IaaS to PaaS):

```typescript
// src/config/database.ts

import mongoose from 'mongoose';

const MONGODB_URI = process.env.COSMOS_CONNECTION_STRING || process.env.MONGODB_URI;

const connectOptions: mongoose.ConnectOptions = {
  // Common options (same as IaaS)
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  // Cosmos DB specific (add these for PaaS)
  retryWrites: false,  // Cosmos DB limitation
  tls: true,           // Required for Cosmos DB
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI, connectOptions);
    console.log('Connected to Cosmos DB for MongoDB vCore');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};
```

**Changes Summary**:
1. ✅ Connection string format (environment variable)
2. ✅ Add `retryWrites: false`
3. ✅ Add `tls: true`
4. ❌ No Mongoose model changes required
5. ❌ No query changes required

---

## Database Schema Design

### Database: `blogapp`

Collections: `users`, `posts`, `comments`

**Schema Compatibility**: 100% compatible with IaaS Workshop schema

### Schema Design Philosophy

**Approach**: Same as IaaS (Hybrid - embedded + referenced)
- **Embed**: Comments within posts (common access pattern)
- **Reference**: Authors/users (avoid duplication)

**Why Same Schema Works**:
- Cosmos DB vCore supports MongoDB wire protocol
- Mongoose ODM works unchanged
- Existing queries execute without modification

---

### Collection: `users`

**Purpose**: Store user profile information from Microsoft Entra ID

#### Schema Definition (Same as IaaS)

```typescript
interface User {
  _id: ObjectId;                    // MongoDB auto-generated ID
  entraUserId: string;              // Microsoft Entra ID user object ID (unique)
  email: string;                    // Email from Entra ID
  displayName: string;              // Display name from Entra ID
  givenName?: string;               // First name (optional)
  surname?: string;                 // Last name (optional)
  profilePicture?: string;          // URL to profile picture
  bio?: string;                     // User biography (max 500 chars)
  createdAt: Date;                  // Account creation timestamp
  updatedAt: Date;                  // Last profile update timestamp
  lastLoginAt: Date;                // Last login timestamp
  isActive: boolean;                // Account status
  role: 'user' | 'admin';           // User role
}
```

#### Indexes

```javascript
// Create indexes (run once during setup)
db.users.createIndex({ "entraUserId": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "displayName": "text" });  // Text search
```

---

### Collection: `posts`

**Purpose**: Store blog posts with embedded comments

#### Schema Definition (Same as IaaS)

```typescript
interface Post {
  _id: ObjectId;
  title: string;                    // Post title (5-200 chars)
  slug: string;                     // URL-friendly slug (unique)
  content: string;                  // Post content (markdown/HTML)
  excerpt?: string;                 // Short summary (auto-generated)
  author: ObjectId;                 // Reference to users collection
  authorName: string;               // Denormalized for display
  status: 'draft' | 'published';    // Publication status
  tags: string[];                   // Post tags (max 5)
  viewCount: number;                // View counter
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;               // When published (if status = published)
  comments: Comment[];              // Embedded comments array
}

interface Comment {
  _id: ObjectId;
  author: ObjectId;                 // Reference to users
  authorName: string;               // Denormalized
  content: string;                  // Comment text (max 1000 chars)
  createdAt: Date;
}
```

#### Indexes

```javascript
// Create indexes
db.posts.createIndex({ "slug": 1 }, { unique: true });
db.posts.createIndex({ "author": 1 });
db.posts.createIndex({ "status": 1, "publishedAt": -1 });  // For listing published posts
db.posts.createIndex({ "tags": 1 });
db.posts.createIndex({ "title": "text", "content": "text" });  // Full-text search
```

---

## Cosmos DB Specific Considerations

### Feature Compatibility Matrix

| MongoDB Feature | Cosmos DB vCore Support | Notes |
|-----------------|------------------------|-------|
| **CRUD Operations** | ✅ Full | Standard operations work |
| **Aggregation Pipeline** | ✅ Full | Complex aggregations supported |
| **Indexes** | ✅ Full | Including text and compound |
| **Transactions** | ✅ Full | Multi-document ACID |
| **Change Streams** | ✅ Full | Real-time change notifications |
| **Retry Writes** | ⚠️ Disabled | Set `retryWrites=false` |
| **Sharding** | ✅ Supported | For large datasets |

### Limitations and Workarounds

#### 1. Retry Writes Disabled

**Issue**: Cosmos DB vCore doesn't support `retryWrites`

**Workaround**: Application-level retry logic

```typescript
// src/utils/retry.util.ts
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Max retries exceeded');
};

// Usage in service
await withRetry(() => Post.create(postData));
```

#### 2. Connection Pooling

**Recommendation**: Limit pool size for Cosmos DB

```typescript
const connectOptions = {
  maxPoolSize: 10,       // Keep reasonable for managed service
  minPoolSize: 2,        // Maintain minimum connections
  maxIdleTimeMS: 120000, // Close idle connections after 2 min
};
```

#### 3. Query Timeout

**Recommendation**: Set appropriate timeouts

```typescript
const connectOptions = {
  serverSelectionTimeoutMS: 5000,   // Fail fast on connection issues
  socketTimeoutMS: 45000,           // Query timeout
};
```

---

## Data Access Patterns

### Common Queries (Same as IaaS)

#### List Published Posts (Paginated)

```typescript
// PostService.findPublished()
const posts = await Post.find({ status: 'published' })
  .sort({ publishedAt: -1 })
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .select('title slug excerpt authorName tags publishedAt viewCount')
  .lean();
```

#### Get Post with Comments

```typescript
// PostService.findBySlug()
const post = await Post.findOne({ slug })
  .populate('author', 'displayName profilePicture')
  .lean();
```

#### Create Post

```typescript
// PostService.create()
const post = await Post.create({
  title,
  slug: generateSlug(title),
  content,
  excerpt: generateExcerpt(content),
  author: userId,
  authorName: user.displayName,
  status: 'draft',
  tags: tags || [],
  viewCount: 0,
  comments: [],
});
```

### Aggregation Example

```typescript
// Get posts by tag with comment count
const postsByTag = await Post.aggregate([
  { $match: { status: 'published', tags: tagName } },
  { $project: {
    title: 1,
    slug: 1,
    authorName: 1,
    publishedAt: 1,
    commentCount: { $size: '$comments' }
  }},
  { $sort: { publishedAt: -1 } },
  { $limit: 10 }
]);
```

---

## Backup and Recovery

### Automatic Backup (Cosmos DB Managed)

| Feature | Cosmos DB vCore | IaaS MongoDB |
|---------|-----------------|--------------|
| **Backup Type** | Continuous (PITR) | Azure Backup + mongodump |
| **Retention** | Configurable (7-35 days) | Manual configuration |
| **Recovery** | Point-in-time restore | Restore from backup |
| **Management** | Fully managed | Manual scripts |

### Point-in-Time Recovery

```bash
# Restore to specific point in time (via Azure CLI)
az cosmosdb mongocluster restore \
  --cluster-name blogapp-cluster \
  --resource-group rg-blogapp \
  --target-cluster-name blogapp-cluster-restored \
  --restore-timestamp "2026-01-27T10:00:00Z"
```

---

## Security Configuration

### Authentication

**Admin User** (created during deployment):
- Username: `blogadmin`
- Password: Stored in Key Vault
- Used for: Application connection

**Best Practice**: Use Azure AD authentication when available (preview feature)

### Network Security

**Private Endpoint Configuration**:
- Public network access: Disabled
- Private Endpoint: In dedicated subnet
- DNS: Private DNS zone for resolution

```bicep
// Disable public access
resource cosmosCluster 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' = {
  properties: {
    publicNetworkAccess: 'Disabled'
  }
}
```

### Secret Management

**Connection String Storage**:
```bicep
resource cosmosConnectionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: 'mongodb+srv://blogadmin:${cosmosAdminPassword}@${cosmosCluster.properties.connectionString}'
  }
}
```

**App Service Reference**:
```bicep
appSettings: [
  {
    name: 'COSMOS_CONNECTION_STRING'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=cosmos-connection-string)'
  }
]
```

---

## Migration Guide: IaaS MongoDB → Cosmos DB vCore

### Step 1: Export Data from IaaS MongoDB

```bash
# On IaaS MongoDB VM
mongodump --uri="mongodb://blogadmin:<password>@10.0.3.4:27017,10.0.3.5:27017/blogapp?replicaSet=blogapp-rs0" \
  --out=/backup/blogapp
```

### Step 2: Import to Cosmos DB vCore

```bash
# From local machine with Cosmos DB access
mongorestore --uri="mongodb+srv://blogadmin:<password>@blogapp-cluster.mongocluster.cosmos.azure.com/?tls=true" \
  --dir=/backup/blogapp
```

### Step 3: Update Application Connection String

```bash
# Change environment variable
# From:
MONGODB_URI=mongodb://blogapp:<password>@10.0.3.4:27017,10.0.3.5:27017/blogapp?replicaSet=blogapp-rs0

# To:
COSMOS_CONNECTION_STRING=mongodb+srv://blogadmin:<password>@blogapp-cluster.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false
```

### Step 4: Verify Indexes

```javascript
// Connect to Cosmos DB and verify indexes
db.users.getIndexes();
db.posts.getIndexes();

// Recreate if needed
db.posts.createIndex({ "slug": 1 }, { unique: true });
```

---

## Monitoring and Diagnostics

### Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **Request Rate** | Operations per second | > 80% of tier limit |
| **Request Latency** | Average response time | > 100ms |
| **Storage Used** | Data + Index storage | > 80% of allocation |
| **Connection Count** | Active connections | > 90% of limit |

### Diagnostic Settings

```bicep
resource cosmosDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'cosmos-diagnostics'
  scope: cosmosCluster
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      { category: 'MongoRequests', enabled: true }
      { category: 'QueryRuntimeStatistics', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}
```

---

## Cost Optimization

### Right-sizing Recommendations

| Workshop Phase | Tier | Monthly Cost | Reason |
|----------------|------|--------------|--------|
| Development | M25 | ~$100 | Minimal testing |
| Workshop Active | M30 | ~$200 | 20-30 users |
| Post-Workshop | Delete or M25 | $0-100 | Reduce when idle |

### Cost Comparison

| Component | IaaS (2 VMs) | PaaS (M30) | Notes |
|-----------|--------------|------------|-------|
| Compute | ~$240/month | ~$200/month | 17% savings |
| Storage | Included | Included | - |
| Backup | Azure Backup cost | Included | Additional savings |
| Patching | Engineer time | Included | Ops savings |
| HA Setup | Manual | Included | Complexity savings |

---

## Appendix: Mongoose Model Examples

### User Model

```typescript
// src/models/User.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  entraUserId: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  profilePicture?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  role: 'user' | 'admin';
}

const UserSchema = new Schema<IUser>({
  entraUserId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: { type: String, required: true, maxlength: 100 },
  givenName: { type: String, maxlength: 50 },
  surname: { type: String, maxlength: 50 },
  profilePicture: { type: String },
  bio: { type: String, maxlength: 500 },
  lastLoginAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, {
  timestamps: true,  // Adds createdAt, updatedAt
});

export const User = mongoose.model<IUser>('User', UserSchema);
```

### Post Model

```typescript
// src/models/Post.model.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

interface IComment {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  authorName: string;
  content: string;
  createdAt: Date;
}

export interface IPost extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  author: Types.ObjectId;
  authorName: string;
  status: 'draft' | 'published';
  tags: string[];
  viewCount: number;
  publishedAt?: Date;
  comments: IComment[];
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

const PostSchema = new Schema<IPost>({
  title: { type: String, required: true, minlength: 5, maxlength: 200 },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true, minlength: 50 },
  excerpt: { type: String, maxlength: 300 },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  tags: [{ type: String, maxlength: 30 }],
  viewCount: { type: Number, default: 0 },
  publishedAt: { type: Date },
  comments: [CommentSchema],
}, {
  timestamps: true,
});

// Indexes
PostSchema.index({ slug: 1 }, { unique: true });
PostSchema.index({ author: 1 });
PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ title: 'text', content: 'text' });

export const Post = mongoose.model<IPost>('Post', PostSchema);
```
