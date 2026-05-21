import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Super Admin oluşturuluyor...\n');

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
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
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
  console.log('🔑 Password: admin123');
  console.log('👤 Role:     SUPER_ADMIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🌐 Giriş URL: http://localhost:3000/auth/signin');
  console.log('🎯 Panel URL: http://localhost:3000/super-admin\n');
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
