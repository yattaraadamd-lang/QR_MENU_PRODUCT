import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ✅ P0-08 FIX: Validate environment and password requirements
function validateSuperAdminConfig() {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  
  // Require environment variable in production
  if (process.env.NODE_ENV === "production" && !password) {
    throw new Error(
      "❌ SECURITY: SUPER_ADMIN_PASSWORD environment variable is required in production. " +
      "Generate a strong password: openssl rand -base64 32"
    );
  }

  // Check for weak/placeholder passwords
  const FORBIDDEN_PASSWORDS = [
    "admin123",
    "superadmin123",
    "password",
    "changeme",
    "change-me",
    "admin",
    "superadmin",
    "123456",
    "password123",
  ];

  const checkPassword = password || "admin123"; // Default for development

  if (FORBIDDEN_PASSWORDS.includes(checkPassword.toLowerCase())) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "❌ SECURITY: SUPER_ADMIN_PASSWORD cannot use weak/placeholder password. " +
        "Generate a strong password: openssl rand -base64 32"
      );
    }
    console.warn("⚠️  Using WEAK super admin password - development only!");
  }

  // Require minimum 12 characters
  if (checkPassword.length < 12) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("❌ SECURITY: SUPER_ADMIN_PASSWORD must be at least 12 characters");
    }
    console.warn("⚠️  Super admin password is too short - development only!");
  }

  return checkPassword;
}

async function main() {
  console.log('🚀 Super Admin oluşturuluyor...\n');

  // ✅ P0-08 FIX: Validate before creating
  const password = validateSuperAdminConfig();

  // Platform business oluştur
  const platformBusiness = await prisma.business.upsert({
    where: { id: 'platform-business' },
    update: {},
    create: {
      id: 'platform-business',
      name: 'QR Menu Platform',
      slug: 'platform',
    },
  });

  console.log('✅ Platform business oluşturuldu:', platformBusiness.id);

  // Super Admin kullanıcısı oluştur
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@qrmenu.com' },
    update: {
      password: hashedPassword, // Şifreyi güncelle
      role: 'SUPER_ADMIN',
    },
    create: {
      businessId: platformBusiness.id,
      name: 'Super Admin',
      email: 'admin@qrmenu.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Super Admin oluşturuldu:', superAdmin.email);
  console.log('\n📋 Giriş Bilgileri:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email:    admin@qrmenu.com');
  
  // ✅ P0-08 FIX: Never log passwords, even in development
  if (process.env.NODE_ENV !== "production") {
    console.log('🔑 Password: (check SUPER_ADMIN_PASSWORD env or using default admin123 for dev)');
  } else {
    console.log('🔑 Password: (set via SUPER_ADMIN_PASSWORD environment variable)');
  }
  
  console.log('👤 Role:     SUPER_ADMIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🌐 Giriş URL: http://localhost:3000/auth/signin');
  console.log('🎯 Panel URL: http://localhost:3000/super-admin\n');
  
  if (process.env.NODE_ENV !== "production") {
    console.warn('⚠️  DEVELOPMENT MODE: Weak password accepted');
    console.warn('⚠️  PRODUCTION: Set SUPER_ADMIN_PASSWORD env variable with strong password\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
