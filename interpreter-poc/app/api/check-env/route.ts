import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    openai_configured: !!process.env.OPENAI_API_KEY,
    webhook_configured: !!process.env.WEBHOOK_SITE_URL,
    database_configured: !!process.env.DATABASE_URL,
    openai_key_prefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'NOT_SET'
  });
} 