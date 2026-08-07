const { execSync } = require('child_process');

console.log('🚀 Starting Render custom build process...');

// ─── SECURITY: Validate critical environment variables ─────────────────────
const REQUIRED_PRODUCTION_ENVS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
];

const RECOMMENDED_ENVS = [
  'CUSTOMER_DEVICE_HMAC_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXTAUTH_URL',
];

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PRODUCTION_ENVS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ SECURITY: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED_ENVS.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(`⚠️  WARNING: Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
}

// Disable Prisma PostgreSQL advisory locks (prevents pooler timeouts on Supabase)
process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';

// Prefer DIRECT (unpooled) database URL for migration if available
if (process.env.DATABASE_URL_UNPOOLED) {
  console.log('🔗 Using DATABASE_URL_UNPOOLED for migrations...');
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

try {
  console.log('📦 1. Running npm install...');
  execSync('npm install', { stdio: 'inherit', env: process.env });

  // ✅ SECURITY FIX: Use `prisma migrate deploy` instead of `db push --accept-data-loss`
  // `db push` can cause data loss and does not use migration files
  // `migrate deploy` applies pending migration files from prisma/migrations/
  console.log('🗄️ 2. Running Prisma migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
    console.log('✅ Migrations applied successfully');
  } catch (migrateError) {
    console.error('❌ CRITICAL: Migration failed! Build will be aborted.');
    console.error('   This prevents deploying code that depends on schema changes');
    console.error('   that have not been applied to the database.');
    console.error('   Error:', migrateError.message);
    process.exit(1);
  }

  console.log('⚙️ 3. Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });

  console.log('🏗️ 4. Building Next.js application...');
  execSync('npx next build', { stdio: 'inherit', env: process.env });

  console.log('✅ Render build completed successfully!');
} catch (error) {
  console.error('❌ Render build failed:', error.message);
  process.exit(1);
}
