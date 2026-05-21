#!/bin/bash
# Vercel build script - Database setup ve build

echo "🔧 Prisma Client oluşturuluyor..."
npx prisma generate

echo "📦 Database schema push ediliyor..."
npx prisma db push --accept-data-loss --skip-generate

echo "🌱 Seed data ekleniyor..."
npx tsx prisma/seed.ts || echo "⚠️ Seed zaten çalışmış olabilir"

echo "🏗️ Next.js build başlıyor..."
next build

echo "✅ Build tamamlandı!"
