/**
 * Seed Script
 * Populate Cosmos DB with sample data for development/testing
 *
 * Usage: npx ts-node scripts/seed.ts
 *
 * Reference: /design/DatabaseDesign.md
 *
 * PaaS Changes from IaaS:
 * - Connection string uses COSMOS_CONNECTION_STRING or MONGODB_URI
 * - Same data model, same Mongoose code
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
import { User, Post, Comment } from '../src/models';

// Support both IaaS (MONGODB_URI) and PaaS (COSMOS_CONNECTION_STRING) naming
const MONGODB_URI =
  process.env.COSMOS_CONNECTION_STRING ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/blogapp?directConnection=true';

// Sample data (same as IaaS)
const sampleUsers = [
  {
    oid: 'sample-user-001',
    email: 'alice@example.com',
    displayName: 'Alice Johnson',
    username: 'alice',
    bio: 'Full-stack developer passionate about Azure and cloud architecture.',
    isActive: true,
    role: 'user' as const,
  },
  {
    oid: 'sample-user-002',
    email: 'bob@example.com',
    displayName: 'Bob Smith',
    username: 'bob',
    bio: 'DevOps engineer with 5 years of AWS experience, now learning Azure.',
    isActive: true,
    role: 'user' as const,
  },
  {
    oid: 'sample-user-003',
    email: 'carol@example.com',
    displayName: 'Carol Williams',
    username: 'carol',
    bio: 'Cloud architect specializing in hybrid cloud solutions.',
    isActive: true,
    role: 'admin' as const,
  },
];

const samplePosts = [
  {
    title: 'Getting Started with Azure App Service',
    slug: 'getting-started-azure-app-service',
    content: `# Getting Started with Azure App Service

Azure App Service is a fully managed platform for building, deploying, and scaling web applications. For those coming from AWS, think of it as the equivalent of Elastic Beanstalk or ECS Fargate.

## Key Concepts

### App Service Plans
An App Service Plan defines the compute resources (CPU, memory) for your web apps. Multiple apps can share the same plan.

**AWS Equivalent**: Similar to choosing instance types in Elastic Beanstalk.

### Deployment Slots
Deployment slots let you run different versions of your app. You can swap slots for zero-downtime deployments.

**AWS Equivalent**: Similar to Blue/Green deployments in Elastic Beanstalk.

## Creating Your First App

1. Navigate to the Azure Portal
2. Click "Create a resource"
3. Select "Web App"
4. Configure the basics (subscription, resource group, name)
5. Choose your runtime stack (Node.js, Python, .NET, etc.)
6. Select your App Service Plan
7. Review and create

## Best Practices

- Use deployment slots for staging environments
- Enable Application Insights for monitoring
- Configure auto-scaling rules for production
- Use Managed Identity for secure authentication to other Azure services

Happy learning!`,
    excerpt: 'Learn how to deploy web applications on Azure App Service, with comparisons to AWS for those transitioning.',
    status: 'published' as const,
    tags: ['azure', 'paas', 'app-service', 'tutorial'],
    viewCount: 156,
  },
  {
    title: 'Understanding Azure PaaS Networking for AWS Engineers',
    slug: 'azure-paas-networking-for-aws-engineers',
    content: `# Understanding Azure PaaS Networking for AWS Engineers

If you're coming from AWS, Azure PaaS networking concepts will feel familiar but have some key differences, especially around Private Endpoints.

## VNet Integration vs Private Endpoints

| Feature | Purpose | AWS Equivalent |
|---------|---------|----------------|
| VNet Integration | Outbound traffic from PaaS to VNet | VPC Interface Endpoint (reversed) |
| Private Endpoint | Inbound traffic to PaaS via private IP | VPC Interface Endpoint |
| Service Endpoint | Optimized routing to Azure services | VPC Gateway Endpoint |

## Key Differences from IaaS Networking

### App Service Networking
- **VNet Integration**: Allows App Service to call resources in your VNet
- **Private Endpoint**: Allows VNet resources to call App Service privately
- **Access Restrictions**: IP-based firewall rules

### Cosmos DB Networking
- **Private Endpoint**: Required for secure access from VNet
- **Public Access**: Can be disabled entirely for security

## Architecture Pattern for This Workshop

\`\`\`
Internet
    |
    v
[Static Web Apps] (Global CDN)
    |
    v
[Application Gateway + WAF]
    |
    v (Private Endpoint)
[App Service]
    |
    v (VNet Integration → Private Endpoint)
[Cosmos DB for MongoDB vCore]
\`\`\`

## Best Practices

1. Use Private Endpoints for all PaaS services
2. Disable public network access where possible
3. Use NAT Gateway for predictable outbound IPs
4. Implement proper NSG rules for defense in depth

This pattern ensures your application is secure while maintaining high availability!`,
    excerpt: 'A comprehensive comparison of Azure PaaS networking concepts for engineers transitioning from AWS.',
    status: 'published' as const,
    tags: ['azure', 'networking', 'paas', 'security'],
    viewCount: 234,
  },
  {
    title: 'Migrating from IaaS to PaaS: A Practical Guide',
    slug: 'migrating-iaas-to-paas-guide',
    content: `# Migrating from IaaS to PaaS: A Practical Guide

This workshop demonstrates a key learning: migrating from IaaS to PaaS often requires minimal code changes. Let's explore what changes and what stays the same.

## What Changes

### Infrastructure
| IaaS | PaaS |
|------|------|
| VMs to manage | Fully managed compute |
| MongoDB on VMs | Cosmos DB for MongoDB |
| Manual scaling | Auto-scaling built-in |
| OS patching required | Fully managed |

### Configuration
| Aspect | IaaS | PaaS |
|--------|------|------|
| Database Connection | mongodb:// with replica set | mongodb+srv:// with TLS |
| Port | 3000 (custom) | 8080 (App Service default) |
| Process Manager | PM2 | Built-in |
| Logging | Files | stdout → App Insights |

## What Stays the Same

### Application Code
- Express.js routes ✅
- Mongoose models ✅
- Authentication logic ✅
- Business logic ✅

### Database Schema
- Same collections
- Same indexes
- Same queries

## The Key Learning

**PaaS is about operational efficiency, not code rewriting.**

The same application code runs on both IaaS and PaaS. The differences are:
- How you deploy
- How you scale
- How you monitor
- How you pay

Happy migrating!`,
    excerpt: 'Learn what changes and what stays the same when migrating from Azure IaaS to PaaS.',
    status: 'published' as const,
    tags: ['azure', 'migration', 'iaas', 'paas', 'architecture'],
    viewCount: 312,
  },
  {
    title: 'Draft: Cosmos DB Performance Tuning',
    slug: 'cosmosdb-performance-tuning',
    content: `# Cosmos DB Performance Tuning

*This is a draft post - work in progress*

## Introduction

Cosmos DB for MongoDB vCore provides familiar MongoDB operations with managed infrastructure...

TODO:
- [ ] Add indexing best practices
- [ ] Include query optimization examples
- [ ] Add monitoring with Azure Monitor
- [ ] Compare with IaaS MongoDB performance`,
    excerpt: 'A deep dive into Cosmos DB for MongoDB vCore performance optimization.',
    status: 'draft' as const,
    tags: ['azure', 'cosmosdb', 'performance'],
    viewCount: 0,
  },
];

const sampleComments = [
  {
    postSlug: 'getting-started-azure-app-service',
    content: 'Great introduction! The AWS comparisons really helped me understand the concepts faster.',
    userIndex: 1, // Bob
  },
  {
    postSlug: 'getting-started-azure-app-service',
    content: 'Thanks for this! How do deployment slots compare with AWS CodeDeploy?',
    userIndex: 2, // Carol
  },
  {
    postSlug: 'azure-paas-networking-for-aws-engineers',
    content: 'The VNet Integration vs Private Endpoint table is super helpful. Bookmarked!',
    userIndex: 0, // Alice
  },
  {
    postSlug: 'migrating-iaas-to-paas-guide',
    content:
      "This is exactly what I needed. The fact that application code stays mostly the same is reassuring.",
    userIndex: 1, // Bob
  },
];

async function seed(): Promise<void> {
  try {
    console.log('🌱 Starting database seed...');
    console.log(`📦 Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);

    // Cosmos DB specific connection options
    const connectOptions: mongoose.ConnectOptions = {
      // Common options (same as IaaS)
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,

      // PaaS-specific: Cosmos DB requires these
      retryWrites: false, // Cosmos DB doesn't support retry writes
      tls: true, // Cosmos DB requires TLS
    };

    await mongoose.connect(MONGODB_URI, connectOptions);
    console.log('✅ Connected to Cosmos DB for MongoDB vCore');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([User.deleteMany({}), Post.deleteMany({}), Comment.deleteMany({})]);

    // Create users
    console.log('👥 Creating users...');
    const users = await User.insertMany(sampleUsers);
    console.log(`   Created ${users.length} users`);

    // Create posts
    console.log('📝 Creating posts...');
    const postsWithAuthors = samplePosts.map((post, index) => ({
      ...post,
      author: users[index % users.length]!._id,
      publishedAt: post.status === 'published' ? new Date(Date.now() - index * 86400000) : undefined,
    }));
    const posts = await Post.insertMany(postsWithAuthors);
    console.log(`   Created ${posts.length} posts`);

    // Create comments
    console.log('💬 Creating comments...');
    const commentsToCreate = [];
    for (const commentData of sampleComments) {
      const post = posts.find((p: { slug: string }) => p.slug === commentData.postSlug);
      if (post) {
        commentsToCreate.push({
          post: post._id,
          author: users[commentData.userIndex]!._id,
          content: commentData.content,
          isEdited: false,
          isDeleted: false,
        });
      }
    }
    const comments = await Comment.insertMany(commentsToCreate);
    console.log(`   Created ${comments.length} comments`);

    console.log('');
    console.log('✨ Seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(
      `   - Posts: ${posts.length} (${posts.filter((p: { status: string }) => p.status === 'published').length} published)`
    );
    console.log(`   - Comments: ${comments.length}`);
    console.log('');
    console.log('🔗 Test the API:');
    console.log('   curl http://localhost:8080/api/posts');
    console.log('   curl http://localhost:8080/api/posts/getting-started-azure-app-service');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

seed();
