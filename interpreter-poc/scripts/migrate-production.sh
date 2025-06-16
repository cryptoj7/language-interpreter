#!/bin/bash
# Production migration script (PostgreSQL)

echo "🔄 Running production database migration (PostgreSQL)..."

# Ensure production environment variables are set
if [ -z "$POSTGRES_PRISMA_URL" ]; then
    echo "❌ Error: POSTGRES_PRISMA_URL environment variable is not set"
    exit 1
fi

# Set production environment
export DATABASE_URL="$POSTGRES_PRISMA_URL"

# Copy PostgreSQL schema to main schema file
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# Generate Prisma client
npx prisma generate

# Deploy migrations (for production)
npx prisma migrate deploy

echo "✅ Production database migration completed!" 