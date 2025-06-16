#!/bin/bash
# Local development migration script (SQLite)

echo "🔄 Running local database migration (SQLite)..."

# Set local environment
export DATABASE_URL="file:./prisma/db.sqlite"

# Copy SQLite schema to main schema file
cp prisma/schema.sqlite.prisma prisma/schema.prisma

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name local-migration

# Seed database if needed
# npx prisma db seed

echo "✅ Local database migration completed!" 