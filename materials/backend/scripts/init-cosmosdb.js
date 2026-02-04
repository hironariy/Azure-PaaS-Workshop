/**
 * Initialize Cosmos DB for MongoDB vCore
 * Creates database and indexes for the blog application
 *
 * Usage:
 *   mongosh "<cosmos-connection-string>" init-cosmosdb.js
 *
 * Or via Azure Portal Mongo Shell
 *
 * Reference: /design/DatabaseDesign.md
 *
 * IaaS Equivalent: /iaas/dev-environment/scripts/init-replica-set.js
 * - IaaS: Initializes MongoDB replica set + creates indexes
 * - PaaS: Cosmos DB handles replication automatically, only need indexes
 */

// Switch to blogapp database (creates if not exists)
db = db.getSiblingDB('blogapp');

print('\n🚀 Initializing Cosmos DB for MongoDB vCore...\n');

// ============================================================================
// Users Collection Indexes
// ============================================================================
print('📋 Creating users collection indexes...');

// Unique index on Microsoft Entra ID Object ID
db.users.createIndex(
  { oid: 1 },
  { unique: true, name: 'idx_users_oid' }
);
print('   ✅ Created unique index on oid');

// Unique index on email
db.users.createIndex(
  { email: 1 },
  { unique: true, name: 'idx_users_email' }
);
print('   ✅ Created unique index on email');

// Unique index on username
db.users.createIndex(
  { username: 1 },
  { unique: true, name: 'idx_users_username' }
);
print('   ✅ Created unique index on username');

// Compound index for listing active users
db.users.createIndex(
  { isActive: 1, createdAt: -1 },
  { name: 'idx_users_active_created' }
);
print('   ✅ Created compound index for active users listing');

// ============================================================================
// Posts Collection Indexes
// ============================================================================
print('\n📋 Creating posts collection indexes...');

// Unique index on slug
db.posts.createIndex(
  { slug: 1 },
  { unique: true, name: 'idx_posts_slug' }
);
print('   ✅ Created unique index on slug');

// Index on author
db.posts.createIndex(
  { author: 1 },
  { name: 'idx_posts_author' }
);
print('   ✅ Created index on author');

// Compound index for listing published posts
db.posts.createIndex(
  { status: 1, publishedAt: -1 },
  { name: 'idx_posts_status_published' }
);
print('   ✅ Created compound index for published posts listing');

// Compound index for user\'s posts
db.posts.createIndex(
  { author: 1, status: 1, createdAt: -1 },
  { name: 'idx_posts_author_status' }
);
print('   ✅ Created compound index for user posts');

// Index on tags
db.posts.createIndex(
  { tags: 1, status: 1, publishedAt: -1 },
  { name: 'idx_posts_tags' }
);
print('   ✅ Created index on tags');

// Text index for search
db.posts.createIndex(
  { title: 'text', content: 'text', tags: 'text' },
  { name: 'idx_posts_text_search' }
);
print('   ✅ Created text search index');

// ============================================================================
// Comments Collection Indexes
// ============================================================================
print('\n📋 Creating comments collection indexes...');

// Index on post
db.comments.createIndex(
  { post: 1 },
  { name: 'idx_comments_post' }
);
print('   ✅ Created index on post');

// Index on author
db.comments.createIndex(
  { author: 1 },
  { name: 'idx_comments_author' }
);
print('   ✅ Created index on author');

// Compound index for listing comments on a post
db.comments.createIndex(
  { post: 1, isDeleted: 1, createdAt: 1 },
  { name: 'idx_comments_post_listing' }
);
print('   ✅ Created compound index for post comments listing');

// Index for threaded comments
db.comments.createIndex(
  { parentComment: 1, createdAt: 1 },
  { name: 'idx_comments_threaded' }
);
print('   ✅ Created index for threaded comments');

// ============================================================================
// Verification
// ============================================================================
print('\n📊 Verifying indexes...\n');

print('Users indexes:');
db.users.getIndexes().forEach((idx) => {
  print('   - ' + idx.name);
});

print('\nPosts indexes:');
db.posts.getIndexes().forEach((idx) => {
  print('   - ' + idx.name);
});

print('\nComments indexes:');
db.comments.getIndexes().forEach((idx) => {
  print('   - ' + idx.name);
});

// ============================================================================
// Summary
// ============================================================================
print('\n' + '='.repeat(60));
print('✅ Cosmos DB for MongoDB vCore initialization complete!');
print('='.repeat(60));
print('\nDatabase: blogapp');
print('Collections: users, posts, comments');
print('\n📝 Comparison with IaaS MongoDB:');
print('   - IaaS: Requires replica set initialization');
print('   - PaaS: Replication handled automatically by Cosmos DB');
print('   - Both: Same indexes, same schema, same application code');
print('\n🔗 Next steps:');
print('   1. Run seed script: npm run seed');
print('   2. Start the application: npm start');
print('');
