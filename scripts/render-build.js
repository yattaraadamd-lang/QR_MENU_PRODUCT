const { execSync } = require('child_process');

console.log('🚀 Starting Render custom build process...');

// Disable Prisma PostgreSQL advisory locks (prevents pooler timeouts on Supabase)
process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';

// Prefer DIRECT (unpooled) database URL for migration/push if available
if (process.env.DATABASE_URL_UNPOOLED) {
  console.log('🔗 Using DATABASE_URL_UNPOOLED for schema push...');
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

try {
  console.log('📦 1. Running npm install...');
  execSync('npm install', { stdio: 'inherit', env: process.env });

  console.log('🗄️ 2. Syncing database schema with Prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });
  } catch (dbError) {
    console.warn('⚠️ Warning: db push encountered an issue, proceeding to build:', dbError.message);
  }

  console.log('⚙️ 3. Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });

  console.log('🏗️ 4. Building Next.js application...');
  execSync('npm run build', { stdio: 'inherit', env: process.env });

  console.log('✅ Render build completed successfully!');
} catch (error) {
  console.error('❌ Render build failed:', error.message);
  process.exit(1);
}
