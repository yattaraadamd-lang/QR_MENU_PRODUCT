#!/bin/bash
# Vercel build script
# Not: Veritabanı şeması build sırasında DEĞİŞTİRİLMEZ (db push / seed yok).
# Şema değişiklikleri ayrı ve bilinçli olarak uygulanmalıdır.

echo "🔧 Prisma Client oluşturuluyor..."
npx prisma generate

echo "🏗️ Next.js build başlıyor..."
next build

echo "✅ Build tamamlandı!"
